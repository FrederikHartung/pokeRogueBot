#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/wave-library-bootstrap-pipeline-run.json"
RUNTIME_DIR="${REPO_ROOT}/data/rl/pipeline-runs/wave-library-bootstrap-remote"
PID_FILE="${RUNTIME_DIR}/remote-bootstrap.pid"
LOG_FILE="${RUNTIME_DIR}/remote-bootstrap.log"

mkdir -p "${RUNTIME_DIR}"

usage() {
  cat <<'EOF'
Usage:
  scripts/run-wave-library-bootstrap-remote.sh start [config_path]
  scripts/run-wave-library-bootstrap-remote.sh status
  scripts/run-wave-library-bootstrap-remote.sh logs
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

  if ! python3 -c 'import torch' >/dev/null 2>&1; then
    echo "Missing Python dependency: torch" >&2
    echo "Install suggestion: python3 -m pip install torch" >&2
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

print_status() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "Remote bootstrap pipeline is running."
    echo "PID: ${pid}"
    echo "Log: ${LOG_FILE}"
    echo "Manifest: ${RUNTIME_DIR}/manifest.json"
    echo "Artifacts summary: ${RUNTIME_DIR}/artifacts-summary.json"
  else
    echo "Remote bootstrap pipeline is not running."
    echo "Log: ${LOG_FILE}"
    echo "Manifest: ${RUNTIME_DIR}/manifest.json"
    echo "Artifacts summary: ${RUNTIME_DIR}/artifacts-summary.json"
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

  nohup bash -lc "cd '${REPO_ROOT}' && npm run rl:pipeline:wave-lib:bootstrap -- '${config_path}'" \
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
