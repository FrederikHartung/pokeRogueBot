#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/modifier-strategic-seeded-remote-10seeds-20runs-wave30.json"
SMOKE_CONFIG="${REPO_ROOT}/data/rl/modifier-strategic-seeded-remote-smoke.json"
CONTROL_DIR="${REPO_ROOT}/data/rl/pipeline-runs/modifier-strategic-seeded-remote-control"
PID_FILE="${CONTROL_DIR}/remote-modifier-strategic-seeded.pid"
ACTIVE_CONFIG_FILE="${CONTROL_DIR}/active-config.txt"
TELEGRAM_CONTROL_PID_FILE="${CONTROL_DIR}/telegram-control.pid"
TELEGRAM_CONTROL_AUTO_FILE="${CONTROL_DIR}/telegram-control.auto"
VENV_DIR="${REPO_ROOT}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python"
VENV_BIN_DIR="${VENV_DIR}/bin"
TELEGRAM_ENV_FILE="${POKEROGUE_NOTIFICATION_ENV_FILE:-${HOME}/.config/pokeroguebot/telegram.env}"
TELEGRAM_POLL_INTERVAL_SECONDS_DEFAULT="600"

mkdir -p "${CONTROL_DIR}"

usage() {
  cat <<'EOF'
Usage:
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh start [config_path]
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh start-smoke
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh status
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh logs
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh last
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh issues
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh notify-test
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-start
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-status
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-stop
  scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh stop
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

value = config.get("output_root", "./pipeline-runs/modifier-strategic-seeded-remote")

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
  runtime_path "${1}" "remote-modifier-strategic.log"
}

error_log_file_for_config() {
  runtime_path "${1}" "remote-modifier-strategic-errors.log"
}

warning_log_file_for_config() {
  runtime_path "${1}" "remote-modifier-strategic-warnings.log"
}

issues_summary_file_for_config() {
  runtime_path "${1}" "issues-summary.txt"
}

manifest_file_for_config() {
  runtime_path "${1}" "manifest.json"
}

metrics_file_for_config() {
  runtime_path "${1}" "collection-metrics.json"
}

artifacts_summary_file_for_config() {
  runtime_path "${1}" "artifacts-summary.json"
}

check_dependencies() {
  echo "Checking dependencies..."
  assert_command node
  assert_command npm
  assert_command python3
  assert_command tar

  if [ ! -x "${VENV_PYTHON}" ]; then
    echo "Repo virtualenv not found at ${VENV_DIR}" >&2
    exit 1
  fi

  if ! "${VENV_PYTHON}" -c 'import torch, numpy' >/dev/null 2>&1; then
    echo "Missing Python dependency: torch" >&2
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
    echo "Missing pokerogue/locales/en. The strategic collector will not start correctly." >&2
    exit 1
  fi
}

run_preflight_checks() {
  local config_path="$1"
  echo "Running RL policy contract tests..."
  (
    cd "${REPO_ROOT}"
    npm run rl:test:policy-contract
    npm run rl:test:modifier:strategic-contract
    npm run rl:test:modifier:strategic-postprocess
  )

  echo "Running pipeline prepare-only validation..."
  (
    cd "${REPO_ROOT}"
    node scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-collection-pipeline.ts "${config_path}" --prepare-only
  )
}

is_running() {
  if [ ! -f "${PID_FILE}" ]; then
    return 1
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  [ -n "${pid}" ] && kill -0 "${pid}" >/dev/null 2>&1
}

is_telegram_control_running() {
  if [ ! -f "${TELEGRAM_CONTROL_PID_FILE}" ]; then
    return 1
  fi
  local pid
  pid="$(cat "${TELEGRAM_CONTROL_PID_FILE}")"
  [ -n "${pid}" ] && kill -0 "${pid}" >/dev/null 2>&1
}

refresh_issue_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local error_log_file
  error_log_file="$(error_log_file_for_config "${config_path}")"
  local warning_log_file
  warning_log_file="$(warning_log_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"

  python3 - "${log_file}" "${error_log_file}" "${warning_log_file}" "${issues_summary_file}" <<'PY'
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
error_log_path = Path(sys.argv[2])
warning_log_path = Path(sys.argv[3])
summary_path = Path(sys.argv[4])

error_pattern = re.compile(r"(error:|exception|traceback|failed\b|fatal\b)", re.IGNORECASE)
warning_pattern = re.compile(r"(\bwarn(?:ing)?\b)", re.IGNORECASE)

errors = []
warnings = []

if log_path.exists():
    for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if error_pattern.search(line):
            errors.append(line)
        elif warning_pattern.search(line):
            warnings.append(line)

error_log_path.write_text("\n".join(errors[-200:]) + ("\n" if errors else ""), encoding="utf-8")
warning_log_path.write_text("\n".join(warnings[-200:]) + ("\n" if warnings else ""), encoding="utf-8")

summary_lines = []
summary_lines.append(f"errors: {len(errors)}")
summary_lines.extend(errors[-20:])
summary_lines.append("")
summary_lines.append(f"warnings: {len(warnings)}")
summary_lines.extend(warnings[-20:])
summary_path.write_text("\n".join(summary_lines).strip() + "\n", encoding="utf-8")
PY
}

print_status() {
  local config_path
  config_path="$(get_active_config_path)"
  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"

  echo "Config: ${config_path}"
  echo "Runtime dir: ${runtime_dir}"
  echo "Log: $(log_file_for_config "${config_path}")"
  echo "Warnings: $(warning_log_file_for_config "${config_path}")"
  echo "Errors: $(error_log_file_for_config "${config_path}")"
  echo "Issues summary: $(issues_summary_file_for_config "${config_path}")"
  echo "Manifest: $(manifest_file_for_config "${config_path}")"
  echo "Artifacts summary: $(artifacts_summary_file_for_config "${config_path}")"
  echo "Metrics: $(metrics_file_for_config "${config_path}")"

  python3 - "$(manifest_file_for_config "${config_path}")" "$(metrics_file_for_config "${config_path}")" <<'PY'
import json
import os
import sys

manifest_path = sys.argv[1]
metrics_path = sys.argv[2]
if os.path.exists(manifest_path):
    manifest = json.load(open(manifest_path, "r", encoding="utf-8"))
    steps = manifest.get("steps", {})
    current = next((name for name, step in steps.items() if step.get("status") == "running"), None)
    print(f"Current phase: {current or 'none'}")
if os.path.exists(metrics_path):
    metrics = json.load(open(metrics_path, "r", encoding="utf-8"))
    print(f"Seeds: {metrics.get('seed_count', '?')}")
    print(f"Batches: {metrics.get('completed_batches', '?')}/{metrics.get('total_batches', '?')}")
    print(f"Episodes: {metrics.get('completed_episodes', '?')}/{metrics.get('total_episodes', '?')}")
    print(f"Transitions: {metrics.get('dataset_rows', '?')}")
PY
}

start_run() {
  local config_path
  config_path="$(canonicalize_config_path "${1:-${DEFAULT_CONFIG}}")"

  if [ ! -f "${config_path}" ]; then
    echo "Config not found: ${config_path}" >&2
    exit 1
  fi
  if is_running; then
    echo "A remote strategic modifier collection run is already running."
    print_status
    exit 1
  fi

  rm -f "${PID_FILE}"
  check_dependencies
  run_preflight_checks "${config_path}"

  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  mkdir -p "${runtime_dir}"
  echo "${config_path}" > "${ACTIVE_CONFIG_FILE}"

  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  : > "$(error_log_file_for_config "${config_path}")"
  : > "$(warning_log_file_for_config "${config_path}")"
  : > "$(issues_summary_file_for_config "${config_path}")"

  local auto_started_telegram_control=0
  if [ -f "${TELEGRAM_ENV_FILE}" ]; then
    if is_telegram_control_running; then
      echo "Telegram control bot already running."
      rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
    else
      telegram_control_start_internal
      auto_started_telegram_control=1
      echo "1" > "${TELEGRAM_CONTROL_AUTO_FILE}"
    fi
  else
    rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
  fi

  local cleanup_command="if [ -f '${TELEGRAM_CONTROL_AUTO_FILE}' ]; then bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-stop >/dev/null 2>&1 || true; rm -f '${TELEGRAM_CONTROL_AUTO_FILE}'; fi; exit \$pipeline_status"

  nohup bash -lc "export PATH='${VENV_BIN_DIR}':\"\$PATH\" && if [ -f '${TELEGRAM_ENV_FILE}' ]; then source '${TELEGRAM_ENV_FILE}'; fi && cd '${REPO_ROOT}' && pipeline_status=0 && npm run rl:pipeline:modifier:strategic:collect -- '${config_path}' || pipeline_status=\$?; ${cleanup_command}" \
    >"${log_file}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  sleep 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "Started detached strategic modifier collection run with PID ${pid}."
    if [ "${auto_started_telegram_control}" -eq 1 ]; then
      echo "Telegram control bot was started automatically."
    fi
    echo "Log: ${log_file}"
  else
    echo "Process exited immediately. Check log: ${log_file}" >&2
    if [ -f "${TELEGRAM_CONTROL_AUTO_FILE}" ]; then
      bash scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh telegram-control-stop >/dev/null 2>&1 || true
      rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
    fi
    exit 1
  fi
}

stop_run() {
  if ! is_running; then
    echo "No running strategic modifier collection process found."
    exit 0
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  echo "Stopping PID ${pid}..."
  kill "${pid}"
  rm -f "${PID_FILE}"
}

show_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  tail -n 200 -f "$(log_file_for_config "${config_path}")"
}

show_last_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  tail -n 50 "$(log_file_for_config "${config_path}")"
}

show_issues() {
  refresh_issue_logs >/dev/null
  cat "$(issues_summary_file_for_config "$(get_active_config_path)")"
}

notify_test() {
  local config_path
  config_path="$(get_active_config_path)"
  if [ -f "${TELEGRAM_ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${TELEGRAM_ENV_FILE}"
  fi
  node scripts/04-automation/telegram/send-pipeline-notification.mjs \
    --event test \
    --runtime-dir "$(runtime_dir_for_config "${config_path}")" \
    --manifest "$(manifest_file_for_config "${config_path}")" \
    --phase manual_test \
    --collection-metrics "$(metrics_file_for_config "${config_path}")"
}

resolve_telegram_poll_interval_seconds() {
  local value="${POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS:-}"
  if [ -z "${value}" ] && [ -f "${TELEGRAM_ENV_FILE}" ]; then
    value="$(bash -lc "source '${TELEGRAM_ENV_FILE}' >/dev/null 2>&1 && printf '%s' \"\${POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS:-}\"")"
  fi
  if [[ "${value}" =~ ^[0-9]+$ ]] && [ "${value}" -gt 0 ]; then
    echo "${value}"
    return 0
  fi
  echo "${TELEGRAM_POLL_INTERVAL_SECONDS_DEFAULT}"
}

telegram_control_start_internal() {
  if is_telegram_control_running; then
    return 0
  fi

  local control_log_file="${CONTROL_DIR}/telegram-control.log"
  local poll_interval_seconds
  poll_interval_seconds="$(resolve_telegram_poll_interval_seconds)"

  nohup bash -lc "export PATH='${VENV_BIN_DIR}':\"\$PATH\" && source '${TELEGRAM_ENV_FILE}' && cd '${REPO_ROOT}' && node scripts/04-automation/telegram/run-telegram-control-bot.mjs --poll-interval-seconds '${poll_interval_seconds}' --state-dir '${CONTROL_DIR}'" \
    >"${control_log_file}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${TELEGRAM_CONTROL_PID_FILE}"
  sleep 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  echo "Telegram control bot exited immediately. Check log: ${control_log_file}" >&2
  exit 1
}

telegram_control_start() {
  check_dependencies

  if [ ! -f "${TELEGRAM_ENV_FILE}" ]; then
    echo "Telegram env file not found: ${TELEGRAM_ENV_FILE}" >&2
    exit 1
  fi

  if is_telegram_control_running; then
    echo "Telegram control bot is already running."
    telegram_control_status
    exit 1
  fi

  telegram_control_start_internal
  local poll_interval_seconds
  poll_interval_seconds="$(resolve_telegram_poll_interval_seconds)"
  echo "Started Telegram control bot with PID $(cat "${TELEGRAM_CONTROL_PID_FILE}")."
  echo "Poll interval: ${poll_interval_seconds}s"
  echo "Log: ${CONTROL_DIR}/telegram-control.log"
}

telegram_control_status() {
  local control_log_file="${CONTROL_DIR}/telegram-control.log"
  local poll_interval_seconds
  poll_interval_seconds="$(resolve_telegram_poll_interval_seconds)"
  if is_telegram_control_running; then
    local pid
    pid="$(cat "${TELEGRAM_CONTROL_PID_FILE}")"
    echo "Telegram control bot is running."
    echo "PID: ${pid}"
  else
    echo "Telegram control bot is not running."
  fi
  echo "Env: ${TELEGRAM_ENV_FILE}"
  echo "Poll interval: ${poll_interval_seconds}s"
  echo "Log: ${control_log_file}"
}

telegram_control_stop() {
  if ! is_telegram_control_running; then
    echo "No running Telegram control bot found."
    exit 0
  fi

  local pid
  pid="$(cat "${TELEGRAM_CONTROL_PID_FILE}")"
  echo "Stopping Telegram control bot PID ${pid}..."
  kill "${pid}"
  rm -f "${TELEGRAM_CONTROL_PID_FILE}"
  rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
  echo "Stop signal sent."
}

case "${1:-}" in
  start)
    start_run "${2:-${DEFAULT_CONFIG}}"
    ;;
  start-smoke)
    start_run "${SMOKE_CONFIG}"
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
  telegram-control-start)
    telegram_control_start
    ;;
  telegram-control-status)
    telegram_control_status
    ;;
  telegram-control-stop)
    telegram_control_stop
    ;;
  stop)
    stop_run
    ;;
  *)
    usage
    exit 1
    ;;
esac
