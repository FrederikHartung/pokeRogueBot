#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/wave-library-iterative-pipeline-remote-10ep.json"
SMOKE_CONFIG="${REPO_ROOT}/data/rl/wave-library-iterative-pipeline-remote-smoke.json"
OVERNIGHT_CONFIG="${REPO_ROOT}/data/rl/wave-library-iterative-pipeline-remote-10ep.json"
CONTROL_DIR="${REPO_ROOT}/data/rl/pipeline-runs/wave-library-iterative-remote-control"
PID_FILE="${CONTROL_DIR}/remote-iterative.pid"
ACTIVE_CONFIG_FILE="${CONTROL_DIR}/active-config.txt"
VENV_DIR="${REPO_ROOT}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python"
VENV_BIN_DIR="${VENV_DIR}/bin"
TELEGRAM_ENV_FILE="${POKEROGUE_NOTIFICATION_ENV_FILE:-${HOME}/.config/pokeroguebot/telegram.env}"

mkdir -p "${CONTROL_DIR}"

usage() {
  cat <<'EOF'
Usage:
  scripts/run-wave-library-bootstrap-remote.sh start [config_path]
  scripts/run-wave-library-bootstrap-remote.sh start-smoke
  scripts/run-wave-library-bootstrap-remote.sh start-overnight
  scripts/run-wave-library-bootstrap-remote.sh status
  scripts/run-wave-library-bootstrap-remote.sh logs
  scripts/run-wave-library-bootstrap-remote.sh last
  scripts/run-wave-library-bootstrap-remote.sh issues
  scripts/run-wave-library-bootstrap-remote.sh notify-test
  scripts/run-wave-library-bootstrap-remote.sh stop

Notes:
  - `start` checks required dependencies and then starts the iterative 5-iteration pipeline detached via `nohup`.
  - `start-smoke` uses the prepared 1-episode smoke config.
  - `start-overnight` uses the prepared larger remote config.
  - The process keeps running after the SSH session closes.
  - `issues` refreshes a separate warning/error summary derived from the log and manifest.
  - If `${TELEGRAM_ENV_FILE}` exists, it is sourced before the detached pipeline starts.
EOF
}

assert_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing dependency: ${command_name}" >&2
    exit 1
  fi
}

canonicalize_config_path() {
  local config_path="${1:-${DEFAULT_CONFIG}}"
  if [[ "${config_path}" != /* ]]; then
    config_path="${REPO_ROOT}/${config_path}"
  fi
  python3 - "${config_path}" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
}

get_active_config_path() {
  if [ -f "${ACTIVE_CONFIG_FILE}" ]; then
    cat "${ACTIVE_CONFIG_FILE}"
    return 0
  fi
  echo "${DEFAULT_CONFIG}"
}

runtime_dir_for_config() {
  local config_path
  config_path="$(canonicalize_config_path "${1:-${DEFAULT_CONFIG}}")"
  python3 - "${config_path}" "${REPO_ROOT}" <<'PY'
import json
import os
import sys

config_path = os.path.realpath(sys.argv[1])
repo_root = os.path.realpath(sys.argv[2])
data_rl_dir = os.path.join(repo_root, "data", "rl")
config_dir = os.path.dirname(config_path)

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

value = config.get("output_root", "./pipeline-runs/wave-library-iterative")

def resolve_path_with_fallbacks(path_value, bases):
    if os.path.isabs(path_value):
        return path_value
    for base in bases:
        candidate = os.path.realpath(os.path.join(base, path_value))
        parent = os.path.dirname(candidate)
        if os.path.isdir(candidate) or os.path.isdir(parent):
            return candidate
    return os.path.realpath(os.path.join(bases[0], path_value))

print(resolve_path_with_fallbacks(value, [config_dir, data_rl_dir, repo_root]))
PY
}

runtime_path() {
  local config_path="$1"
  local file_name="$2"
  echo "$(runtime_dir_for_config "${config_path}")/${file_name}"
}

log_file_for_config() {
  runtime_path "${1}" "remote-iterative.log"
}

error_log_file_for_config() {
  runtime_path "${1}" "remote-iterative-errors.log"
}

warning_log_file_for_config() {
  runtime_path "${1}" "remote-iterative-warnings.log"
}

issues_summary_file_for_config() {
  runtime_path "${1}" "issues-summary.txt"
}

manifest_file_for_config() {
  runtime_path "${1}" "manifest.json"
}

artifacts_summary_file_for_config() {
  runtime_path "${1}" "artifacts-summary.json"
}

check_dependencies() {
  echo "Checking dependencies..."
  assert_command node
  assert_command npm
  assert_command python3

  if [ -x "${VENV_PYTHON}" ]; then
    echo "Using repo virtualenv: ${VENV_DIR}"
  else
    echo "Repo virtualenv not found at ${VENV_DIR}" >&2
    echo "Create it first, for example:" >&2
    echo "  python3 -m venv .venv" >&2
    echo "  source .venv/bin/activate" >&2
    echo "  python -m pip install --upgrade pip" >&2
    echo "  python -m pip install torch numpy" >&2
    exit 1
  fi

  if ! "${VENV_PYTHON}" -c 'import torch, numpy' >/dev/null 2>&1; then
    echo "Missing Python dependency: torch" >&2
    echo "Install suggestion inside repo venv:" >&2
    echo "  source .venv/bin/activate" >&2
    echo "  python -m pip install torch numpy" >&2
    exit 1
  fi

  if [ ! -d "${REPO_ROOT}/node_modules" ]; then
    echo "Missing root node_modules. Run: npm install" >&2
    exit 1
  fi

  if [ ! -d "${REPO_ROOT}/pokerogue/node_modules" ]; then
    echo "Missing pokerogue/node_modules. Run: (cd pokerogue && npm install)" >&2
    exit 1
  fi

  if [ ! -d "${REPO_ROOT}/pokerogue/locales/en" ]; then
    echo "Missing pokerogue/locales/en. The headless collector will not start correctly." >&2
    exit 1
  fi

  echo "Dependencies look good."
}

is_running() {
  if [ ! -f "${PID_FILE}" ]; then
    return 1
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  if [ -z "${pid}" ]; then
    return 1
  fi

  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

format_duration_human() {
  local total_seconds="${1:-0}"
  if [ "${total_seconds}" -lt 0 ] 2>/dev/null; then
    total_seconds=0
  fi
  local days=$((total_seconds / 86400))
  local hours=$(((total_seconds % 86400) / 3600))
  local minutes=$(((total_seconds % 3600) / 60))
  local seconds=$((total_seconds % 60))

  if [ "${days}" -gt 0 ]; then
    printf "%dd %02dh %02dm %02ds" "${days}" "${hours}" "${minutes}" "${seconds}"
  elif [ "${hours}" -gt 0 ]; then
    printf "%dh %02dm %02ds" "${hours}" "${minutes}" "${seconds}"
  elif [ "${minutes}" -gt 0 ]; then
    printf "%dm %02ds" "${minutes}" "${seconds}"
  else
    printf "%ds" "${seconds}"
  fi
}

print_manifest_summary() {
  local manifest_path="$1"
  if [ ! -f "${manifest_path}" ]; then
    return 0
  fi

  python3 - "${manifest_path}" <<'PY'
import json
import sys

manifest_path = sys.argv[1]
with open(manifest_path, "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

batches = manifest.get("batches", [])
steps = manifest.get("steps", {})

total = len(batches)
completed = sum(1 for batch in batches if batch.get("status") == "completed")
failed = sum(1 for batch in batches if batch.get("status") == "failed")
remaining = total - completed
planned_episodes = sum(int(batch.get("episodes", 0) or 0) for batch in batches)
completed_episodes = sum(int(batch.get("episodes", 0) or 0) for batch in batches if batch.get("status") == "completed")
remaining_episodes = planned_episodes - completed_episodes
scenario_names = {
    str(batch.get("scenario_name"))
    for batch in batches
    if batch.get("scenario_name") is not None
}
scenario_count = len(scenario_names)
episodes_per_scenario_values = set()
for batch in batches:
    phase = str(batch.get("phase") or "")
    if phase != "baseline_collect":
        continue
    episodes_per_scenario_values.add(int(batch.get("episodes", 0) or 0))
running_batch = next((batch for batch in batches if batch.get("status") == "running"), None)
failed_steps = [(name, step) for name, step in steps.items() if step.get("status") == "failed"]
failed_batches = [batch for batch in batches if batch.get("status") == "failed"]

current_step = None
for step_name, step in steps.items():
    if step.get("status") == "running":
        current_step = step_name
        break

if current_step is None:
    for step_name, step in steps.items():
        if step.get("status") != "completed":
            current_step = step_name
            break

completed_batch_durations_ms = [
    int(batch.get("duration_ms"))
    for batch in batches
    if batch.get("status") == "completed" and isinstance(batch.get("duration_ms"), int)
]
avg_batch_duration_ms = int(sum(completed_batch_durations_ms) / len(completed_batch_durations_ms)) if completed_batch_durations_ms else 0
eta_seconds = int((avg_batch_duration_ms * remaining) / 1000) if avg_batch_duration_ms > 0 and remaining > 0 else None

completed_step_durations_ms = [
    int(step.get("duration_ms"))
    for step in steps.values()
    if step.get("status") == "completed" and isinstance(step.get("duration_ms"), int)
]
total_step_duration_seconds = int(sum(completed_step_durations_ms) / 1000) if completed_step_durations_ms else None

def fmt_seconds(total_seconds):
    if total_seconds is None:
        return "unknown"
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if days > 0:
        return f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s"
    if hours > 0:
        return f"{hours}h {minutes:02d}m {seconds:02d}s"
    if minutes > 0:
        return f"{minutes}m {seconds:02d}s"
    return f"{seconds}s"

if failed_steps or failed_batches:
    print("Pipeline state: failed")
elif current_step is None and all(step.get("status") == "completed" for step in steps.values()):
    print("Pipeline state: completed")
else:
    print("Pipeline state: healthy")
print(f"Phase: {current_step or 'completed'}")
print(f"Batches: {completed}/{total} completed, {failed} failed, {remaining} remaining")
if scenario_count > 0:
    print(f"Scenarios: {scenario_count}")
if len(episodes_per_scenario_values) == 1:
    value = next(iter(episodes_per_scenario_values))
    print(f"Episodes per scenario: {value}")
print(f"Episodes: {completed_episodes}/{planned_episodes} completed, {remaining_episodes} remaining")
if completed_batch_durations_ms:
    print(f"Average batch duration: {fmt_seconds(int(avg_batch_duration_ms / 1000))}")
if total_step_duration_seconds is not None:
    print(f"Accumulated step runtime: {fmt_seconds(total_step_duration_seconds)}")
print(f"ETA: {fmt_seconds(eta_seconds)}")

if running_batch is not None:
    print(
        "Current batch: "
        f"{running_batch.get('phase')} / wave {running_batch.get('wave_index')} / "
        f"{running_batch.get('scenario_name')} / batch {int(running_batch.get('batch_index', 0)) + 1}"
    )

if failed_steps:
    last_failed_step_name, last_failed_step = failed_steps[-1]
    print(f"Failed step: {last_failed_step_name}")
    if last_failed_step.get("error"):
        print(f"Step error: {last_failed_step.get('error')}")

if failed_batches:
    last_failed_batch = failed_batches[-1]
    print(
        "Failed batch: "
        f"{last_failed_batch.get('phase')} / wave {last_failed_batch.get('wave_index')} / "
        f"{last_failed_batch.get('scenario_name')} / batch {int(last_failed_batch.get('batch_index', 0)) + 1}"
    )
    if last_failed_batch.get("error"):
        print(f"Batch error: {last_failed_batch.get('error')}")
PY
}

refresh_issue_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local manifest_file
  manifest_file="$(manifest_file_for_config "${config_path}")"
  local error_log_file
  error_log_file="$(error_log_file_for_config "${config_path}")"
  local warning_log_file
  warning_log_file="$(warning_log_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"

  python3 - "${log_file}" "${manifest_file}" "${error_log_file}" "${warning_log_file}" "${issues_summary_file}" <<'PY'
import json
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
error_log_path = Path(sys.argv[3])
warning_log_path = Path(sys.argv[4])
summary_path = Path(sys.argv[5])

error_pattern = re.compile(r"(error:|exception|traceback|command failed|failed\b|fatal\b)", re.IGNORECASE)
warning_pattern = re.compile(r"(\bwarn(?:ing)?\b)", re.IGNORECASE)
ignored_error_patterns = [
    re.compile(r"Vitest exited non-zero, but output exists\. Continuing\.", re.IGNORECASE),
]

error_lines = []
warning_lines = []

if log_path.exists():
    for raw_line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if warning_pattern.search(line):
            warning_lines.append(line)
        if error_pattern.search(line):
            if any(pattern.search(line) for pattern in ignored_error_patterns):
                continue
            error_lines.append(line)

manifest_errors = []
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for step_name, step in (manifest.get("steps") or {}).items():
        if step.get("status") == "failed" or step.get("error"):
            manifest_errors.append(f"[manifest step:{step_name}] status={step.get('status')} error={step.get('error')}")
    for batch in manifest.get("batches") or []:
        if batch.get("status") == "failed" or batch.get("error"):
            manifest_errors.append(
                f"[manifest batch:{batch.get('id')}] phase={batch.get('phase')} status={batch.get('status')} error={batch.get('error')}"
            )

seen_errors = set()
deduped_errors = []
for line in error_lines + manifest_errors:
    if line not in seen_errors:
        seen_errors.add(line)
        deduped_errors.append(line)

seen_warnings = set()
deduped_warnings = []
for line in warning_lines:
    if line not in seen_warnings:
        seen_warnings.add(line)
        deduped_warnings.append(line)

error_log_path.write_text("".join(f"{line}\n" for line in deduped_errors), encoding="utf-8")
warning_log_path.write_text("".join(f"{line}\n" for line in deduped_warnings), encoding="utf-8")

summary_lines = [
    f"Error count: {len(deduped_errors)}",
    f"Warning count: {len(deduped_warnings)}",
    f"Log: {log_path}",
    f"Manifest: {manifest_path}",
    f"Errors file: {error_log_path}",
    f"Warnings file: {warning_log_path}",
]

if deduped_errors:
    summary_lines.append("")
    summary_lines.append("Recent errors:")
    summary_lines.extend(deduped_errors[-10:])

if deduped_warnings:
    summary_lines.append("")
    summary_lines.append("Recent warnings:")
    summary_lines.extend(deduped_warnings[-10:])

summary_path.write_text("".join(f"{line}\n" for line in summary_lines), encoding="utf-8")
print(summary_path)
PY
}

print_status() {
  local config_path
  config_path="$(get_active_config_path)"
  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local error_log_file
  error_log_file="$(error_log_file_for_config "${config_path}")"
  local warning_log_file
  warning_log_file="$(warning_log_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"
  local manifest_file
  manifest_file="$(manifest_file_for_config "${config_path}")"
  local artifacts_summary_file
  artifacts_summary_file="$(artifacts_summary_file_for_config "${config_path}")"

  refresh_issue_logs >/dev/null 2>&1 || true
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "Remote iterative pipeline is running."
    echo "PID: ${pid}"
    echo "Config: ${config_path}"
    local started_at
    started_at="$(ps -p "${pid}" -o lstart= 2>/dev/null | sed 's/^ *//')"
    local elapsed_raw
    elapsed_raw="$(ps -p "${pid}" -o etimes= 2>/dev/null | tr -d ' ')"
    if [ -n "${started_at}" ]; then
      echo "Started: ${started_at}"
    fi
    if [ -n "${elapsed_raw}" ]; then
      echo "Elapsed: $(format_duration_human "${elapsed_raw}")"
    fi
  else
    echo "Remote iterative pipeline is not running."
    echo "Config: ${config_path}"
  fi

  echo "Runtime dir: ${runtime_dir}"
  echo "Log: ${log_file}"
  echo "Warnings: ${warning_log_file}"
  echo "Errors: ${error_log_file}"
  echo "Issues summary: ${issues_summary_file}"
  echo "Manifest: ${manifest_file}"
  echo "Artifacts summary: ${artifacts_summary_file}"
  print_manifest_summary "${manifest_file}"
}

start_pipeline() {
  local config_path
  config_path="$(canonicalize_config_path "${1:-${DEFAULT_CONFIG}}")"

  if [ ! -f "${config_path}" ]; then
    echo "Config not found: ${config_path}" >&2
    exit 1
  fi

  if is_running; then
    echo "An iterative remote pipeline is already running."
    print_status
    exit 1
  fi

  rm -f "${PID_FILE}"
  check_dependencies

  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  mkdir -p "${runtime_dir}"

  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local error_log_file
  error_log_file="$(error_log_file_for_config "${config_path}")"
  local warning_log_file
  warning_log_file="$(warning_log_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"

  echo "${config_path}" > "${ACTIVE_CONFIG_FILE}"

  echo "Starting remote iterative pipeline..."
  echo "Config: ${config_path}"
  echo "Runtime dir: ${runtime_dir}"
  echo "Log: ${log_file}"
  if [ -f "${TELEGRAM_ENV_FILE}" ]; then
    echo "Notification env: ${TELEGRAM_ENV_FILE}"
  else
    echo "Notification env: not found (${TELEGRAM_ENV_FILE})"
  fi
  : > "${error_log_file}"
  : > "${warning_log_file}"
  : > "${issues_summary_file}"
  echo "Python: ${VENV_PYTHON}"

  nohup bash -lc "export PATH='${VENV_BIN_DIR}':\"\$PATH\" && if [ -f '${TELEGRAM_ENV_FILE}' ]; then source '${TELEGRAM_ENV_FILE}'; fi && cd '${REPO_ROOT}' && npm run rl:pipeline:wave-lib:iterative -- '${config_path}'" \
    >"${log_file}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  sleep 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "Started detached pipeline with PID ${pid}."
    echo "The process will continue after SSH disconnect."
    echo "Follow logs with:"
    echo "  scripts/run-wave-library-bootstrap-remote.sh logs"
  else
    echo "Pipeline process exited immediately. Check log: ${log_file}" >&2
    exit 1
  fi
}

notify_test() {
  local config_path
  config_path="$(get_active_config_path)"
  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  local manifest_file
  manifest_file="$(manifest_file_for_config "${config_path}")"
  local artifacts_summary_file
  artifacts_summary_file="$(artifacts_summary_file_for_config "${config_path}")"
  local benchmark_summary_file="${runtime_dir}/benchmark-summary.json"
  local args=(
    scripts/send-pipeline-notification.mjs
    --event test
    --runtime-dir "${runtime_dir}"
    --manifest "${manifest_file}"
    --phase manual_test
    --artifacts-summary "${artifacts_summary_file}"
  )

  if [ -f "${benchmark_summary_file}" ]; then
    args+=(--benchmark-summary "${benchmark_summary_file}")
  fi

  if [ -f "${TELEGRAM_ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${TELEGRAM_ENV_FILE}"
  fi

  node "${args[@]}"
}

stop_pipeline() {
  if ! is_running; then
    echo "No running remote iterative pipeline found."
    exit 0
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  echo "Stopping PID ${pid}..."
  kill "${pid}"
  rm -f "${PID_FILE}"
  echo "Stop signal sent."
}

show_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  if [ -f "${log_file}" ]; then
    tail -n 200 -f "${log_file}"
  else
    echo "Log file not found: ${log_file}" >&2
    exit 1
  fi
}

show_last_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  if [ -f "${log_file}" ]; then
    tail -n 50 "${log_file}"
  else
    echo "Log file not found: ${log_file}" >&2
    exit 1
  fi
}

show_issues() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local manifest_file
  manifest_file="$(manifest_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"

  if [ ! -f "${log_file}" ] && [ ! -f "${manifest_file}" ]; then
    echo "Neither log nor manifest found for config ${config_path}" >&2
    exit 1
  fi

  refresh_issue_logs >/dev/null
  cat "${issues_summary_file}"
}

main() {
  local command="${1:-}"
  case "${command}" in
    start)
      start_pipeline "${2:-${DEFAULT_CONFIG}}"
      ;;
    start-smoke)
      start_pipeline "${SMOKE_CONFIG}"
      ;;
    start-overnight)
      start_pipeline "${OVERNIGHT_CONFIG}"
      ;;
    status)
      print_status
      ;;
    logs)
      show_logs
      ;;
    last)
      show_last_logs
      ;;
    issues)
      show_issues
      ;;
    notify-test)
      notify_test
      ;;
    stop)
      stop_pipeline
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
