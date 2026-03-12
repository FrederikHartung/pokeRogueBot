#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/wave-library-bootstrap-pipeline-run.json"
RUNTIME_DIR="${REPO_ROOT}/data/rl/pipeline-runs/wave-library-bootstrap-remote"
PID_FILE="${RUNTIME_DIR}/remote-bootstrap.pid"
LOG_FILE="${RUNTIME_DIR}/remote-bootstrap.log"
VENV_DIR="${REPO_ROOT}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python"
VENV_BIN_DIR="${VENV_DIR}/bin"

mkdir -p "${RUNTIME_DIR}"

usage() {
  cat <<'EOF'
Usage:
  scripts/run-wave-library-bootstrap-remote.sh start [config_path]
  scripts/run-wave-library-bootstrap-remote.sh status
  scripts/run-wave-library-bootstrap-remote.sh logs
  scripts/run-wave-library-bootstrap-remote.sh last
  scripts/run-wave-library-bootstrap-remote.sh stop

Notes:
  - `start` checks required dependencies and then starts the remote batch pipeline detached via `nohup`.
  - The process keeps running after the SSH session closes.
  - `config_path` defaults to `data/rl/wave-library-bootstrap-pipeline-run.json`.
EOF
}

assert_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing dependency: ${command_name}" >&2
    exit 1
  fi
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
  if [ ! -f "${RUNTIME_DIR}/manifest.json" ]; then
    return 0
  fi

  python3 - "${RUNTIME_DIR}/manifest.json" <<'PY'
import json
import sys
from datetime import datetime, timezone

manifest_path = sys.argv[1]
with open(manifest_path, "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

batches = manifest.get("batches", [])
steps = manifest.get("steps", {})

total = len(batches)
completed = sum(1 for batch in batches if batch.get("status") == "completed")
failed = sum(1 for batch in batches if batch.get("status") == "failed")
running_batch = next((batch for batch in batches if batch.get("status") == "running"), None)

step_order = [
    "random_collect",
    "random_report",
    "train_initial",
    "benchmark_initial",
    "dqn_collect",
    "dqn_report",
    "merge_final",
    "train_final",
    "benchmark_final",
]

current_step = None
for step_name in step_order:
    step = steps.get(step_name)
    if step and step.get("status") == "running":
        current_step = step_name
        break

if current_step is None:
    for step_name in step_order:
        step = steps.get(step_name)
        if step and step.get("status") != "completed":
            current_step = step_name
            break

completed_durations_ms = [
    int(batch.get("duration_ms"))
    for batch in batches
    if batch.get("status") == "completed" and isinstance(batch.get("duration_ms"), int)
]
avg_batch_duration_ms = int(sum(completed_durations_ms) / len(completed_durations_ms)) if completed_durations_ms else 0
remaining = total - completed
eta_seconds = int((avg_batch_duration_ms * remaining) / 1000) if avg_batch_duration_ms > 0 and remaining > 0 else None

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

print(f"Phase: {current_step or 'unknown'}")
print(f"Batches: {completed}/{total} completed, {failed} failed, {remaining} remaining")
if completed_durations_ms:
    print(f"Average batch duration: {fmt_seconds(int(avg_batch_duration_ms / 1000))}")
print(f"ETA: {fmt_seconds(eta_seconds)}")

if running_batch is not None:
    print(
        "Current batch: "
        f"{running_batch.get('phase')} / wave {running_batch.get('wave_index')} / "
        f"{running_batch.get('scenario_name')} / batch {int(running_batch.get('batch_index', 0)) + 1}"
    )
PY
}

print_status() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "Remote bootstrap pipeline is running."
    echo "PID: ${pid}"
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
    echo "Log: ${LOG_FILE}"
    echo "Manifest: ${RUNTIME_DIR}/manifest.json"
    echo "Artifacts summary: ${RUNTIME_DIR}/artifacts-summary.json"
    print_manifest_summary
  else
    echo "Remote bootstrap pipeline is not running."
    echo "Log: ${LOG_FILE}"
    echo "Manifest: ${RUNTIME_DIR}/manifest.json"
    echo "Artifacts summary: ${RUNTIME_DIR}/artifacts-summary.json"
    print_manifest_summary
  fi
}

start_pipeline() {
  local config_path="${1:-${DEFAULT_CONFIG}}"
  if [[ "${config_path}" != /* ]]; then
    config_path="${REPO_ROOT}/${config_path}"
  fi

  if [ ! -f "${config_path}" ]; then
    echo "Config not found: ${config_path}" >&2
    exit 1
  fi

  if is_running; then
    echo "A remote bootstrap pipeline is already running."
    print_status
    exit 1
  fi

  check_dependencies

  echo "Starting remote bootstrap pipeline..."
  echo "Config: ${config_path}"
  echo "Log: ${LOG_FILE}"
  echo "Python: ${VENV_PYTHON}"

  nohup bash -lc "export PATH='${VENV_BIN_DIR}':\"\$PATH\" && cd '${REPO_ROOT}' && npm run rl:pipeline:wave-lib:bootstrap -- '${config_path}'" \
    >"${LOG_FILE}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  sleep 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "Started detached pipeline with PID ${pid}."
    echo "The process will continue after SSH disconnect."
    echo "Follow logs with:"
    echo "  scripts/run-wave-library-bootstrap-remote.sh logs"
  else
    echo "Pipeline process exited immediately. Check log: ${LOG_FILE}" >&2
    exit 1
  fi
}

stop_pipeline() {
  if ! is_running; then
    echo "No running remote bootstrap pipeline found."
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
  if [ -f "${LOG_FILE}" ]; then
    tail -n 200 -f "${LOG_FILE}"
  else
    echo "Log file not found: ${LOG_FILE}" >&2
    exit 1
  fi
}

show_last_logs() {
  if [ -f "${LOG_FILE}" ]; then
    tail -n 50 "${LOG_FILE}"
  else
    echo "Log file not found: ${LOG_FILE}" >&2
    exit 1
  fi
}

main() {
  local command="${1:-}"
  case "${command}" in
    start)
      start_pipeline "${2:-${DEFAULT_CONFIG}}"
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
