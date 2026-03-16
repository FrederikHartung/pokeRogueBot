#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/train-dqn-offline-wave-library-random-valid-action-v3-server.json"
CONTROL_DIR="${REPO_ROOT}/data/rl/training-runs/offline-dqn-remote-control"
PID_FILE="${CONTROL_DIR}/remote-offline-dqn-training.pid"
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
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh start [config_path]
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh status
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh logs
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh last
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh issues
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh notify-test
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-start
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-status
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-stop
  scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh stop
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
config_dir = os.path.dirname(config_path)

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

runtime_dir = config.get("remote_runtime_dir")
if runtime_dir:
    if os.path.isabs(runtime_dir):
        print(os.path.realpath(runtime_dir))
    else:
        print(os.path.realpath(os.path.join(repo_root, runtime_dir)))
    raise SystemExit(0)

output_path = config.get("output_path", "./data/rl/models/dqn-combat-wave-library-bootstrap-combined-960.pt")
checkpoint_base = os.path.splitext(os.path.basename(output_path))[0]
print(os.path.realpath(os.path.join(repo_root, "data", "rl", "training-runs", checkpoint_base)))
PY
}

runtime_path() {
  local config_path="$1"
  local file_name="$2"
  echo "$(runtime_dir_for_config "${config_path}")/${file_name}"
}

log_file_for_config() { runtime_path "${1}" "offline-dqn-training.log"; }
error_log_file_for_config() { runtime_path "${1}" "offline-dqn-training-errors.log"; }
warning_log_file_for_config() { runtime_path "${1}" "offline-dqn-training-warnings.log"; }
issues_summary_file_for_config() { runtime_path "${1}" "issues-summary.txt"; }
summary_file_for_config() { runtime_path "${1}" "training-summary.json"; }
progress_file_for_config() { runtime_path "${1}" "training-progress.json"; }
state_file_for_config() { runtime_path "${1}" "training-state.json"; }
generated_config_file_for_config() { runtime_path "${1}" "generated-train-config.json"; }
runner_script_for_config() { runtime_path "${1}" "run-training.sh"; }

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

check_dependencies() {
  echo "Checking dependencies..."
  assert_command node
  assert_command npm
  assert_command python3

  if [ -x "${VENV_PYTHON}" ]; then
    echo "Using repo virtualenv: ${VENV_DIR}"
  else
    echo "Repo virtualenv not found at ${VENV_DIR}" >&2
    exit 1
  fi

  if ! "${VENV_PYTHON}" -c 'import torch, numpy' >/dev/null 2>&1; then
    echo "Missing Python dependency: torch or numpy" >&2
    exit 1
  fi

  if [ ! -d "${REPO_ROOT}/node_modules" ]; then
    echo "Missing root node_modules. Run: npm install" >&2
    exit 1
  fi
}

run_preflight_checks() {
  local config_path="$1"
  local generated_config_path
  generated_config_path="$(prepare_generated_config "${config_path}")"

  echo "Running RL policy contract tests..."
  (
    cd "${REPO_ROOT}"
    npm run rl:test:policy-contract
  )

  echo "Running training config validation..."
  python3 - "${generated_config_path}" <<'PY'
import json
import os
import sys

config_path = sys.argv[1]
with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

dataset_path = config.get("dataset_path")
output_path = config.get("output_path")
if not dataset_path:
    raise SystemExit("Missing dataset_path in training config")
if not output_path:
    raise SystemExit("Missing output_path in training config")

merge = config.get("dataset_merge") or {}
inputs = merge.get("inputs") or []
if inputs and not isinstance(inputs, list):
    raise SystemExit("dataset_merge.inputs must be a list")

print(f"Validated config: dataset_path={dataset_path}")
print(f"Validated config: output_path={output_path}")
print(f"Validated config: merge_inputs={len(inputs)}")
PY
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

prepare_generated_config() {
  local config_path="$1"
  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  local summary_path
  summary_path="$(summary_file_for_config "${config_path}")"
  local progress_path
  progress_path="$(progress_file_for_config "${config_path}")"
  local generated_config_path
  generated_config_path="$(generated_config_file_for_config "${config_path}")"
  mkdir -p "${runtime_dir}"

  python3 - "${config_path}" "${generated_config_path}" "${summary_path}" "${progress_path}" <<'PY'
import json
import os
import sys

source_config_path = sys.argv[1]
generated_config_path = sys.argv[2]
summary_path = sys.argv[3]
progress_path = sys.argv[4]

with open(source_config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

dataset_merge = config.get("dataset_merge") or {}
merge_output_path = dataset_merge.get("output_path")
if merge_output_path:
    config["dataset_path"] = merge_output_path

config["summary_output_path"] = summary_path
config["progress_output_path"] = progress_path

os.makedirs(os.path.dirname(generated_config_path), exist_ok=True)
with open(generated_config_path, "w", encoding="utf-8") as handle:
    json.dump(config, handle, indent=2)
PY

  echo "${generated_config_path}"
}

refresh_issue_logs() {
  local config_path
  config_path="$(get_active_config_path)"
  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  local state_file
  state_file="$(state_file_for_config "${config_path}")"
  local error_log_file
  error_log_file="$(error_log_file_for_config "${config_path}")"
  local warning_log_file
  warning_log_file="$(warning_log_file_for_config "${config_path}")"
  local issues_summary_file
  issues_summary_file="$(issues_summary_file_for_config "${config_path}")"

  python3 - "${log_file}" "${state_file}" "${error_log_file}" "${warning_log_file}" "${issues_summary_file}" <<'PY'
import json
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
state_path = Path(sys.argv[2])
error_log_path = Path(sys.argv[3])
warning_log_path = Path(sys.argv[4])
summary_path = Path(sys.argv[5])

error_pattern = re.compile(r"(error:|exception|traceback|failed\b|fatal\b)", re.IGNORECASE)
warning_pattern = re.compile(r"(\bwarn(?:ing)?\b)", re.IGNORECASE)

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
            error_lines.append(line)

state_error = None
if state_path.exists():
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state_error = state.get("error")
    if state_error:
        error_lines.append(f"[state] {state_error}")

deduped_errors = list(dict.fromkeys(error_lines))
deduped_warnings = list(dict.fromkeys(warning_lines))

error_log_path.write_text("".join(f"{line}\n" for line in deduped_errors), encoding="utf-8")
warning_log_path.write_text("".join(f"{line}\n" for line in deduped_warnings), encoding="utf-8")

summary_lines = [
    f"Error count: {len(deduped_errors)}",
    f"Warning count: {len(deduped_warnings)}",
    f"Log: {log_path}",
    f"State: {state_path}",
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
PY
}

print_training_summary() {
  local config_path="$1"
  python3 - "${config_path}" "$(state_file_for_config "${config_path}")" "$(summary_file_for_config "${config_path}")" "$(log_file_for_config "${config_path}")" <<'PY'
import json
import os
import re
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
state_path = Path(sys.argv[2])
summary_path = Path(sys.argv[3])
log_path = Path(sys.argv[4])

config = json.loads(config_path.read_text(encoding="utf-8")) if config_path.exists() else {}
state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}

status = state.get("status", "not_started")
print(f"Training state: {status}")
print(f"Dataset: {config.get('dataset_path')}")
print(f"Checkpoint: {config.get('output_path')}")

if summary:
    metrics = summary.get("epoch_metrics") or []
    print(f"Epochs: {len(metrics)}/{summary.get('epochs', '?')}")
    if metrics:
        latest = metrics[-1]
        print(f"Latest mean loss: {latest.get('mean_loss'):.6f}")
    runtime_ms = summary.get("total_runtime_ms")
    if isinstance(runtime_ms, int):
        print(f"Total runtime ms: {runtime_ms}")
    raise SystemExit(0)

latest_epoch = None
pattern = re.compile(r"epoch=(\d+)/(\d+)\s+mean_loss=([0-9.]+)")
if log_path.exists():
    for raw_line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = pattern.search(raw_line)
        if match:
            latest_epoch = (
                int(match.group(1)),
                int(match.group(2)),
                float(match.group(3)),
            )

if latest_epoch is not None:
    current, total, mean_loss = latest_epoch
    print(f"Epochs: {current}/{total}")
    print(f"Latest mean loss: {mean_loss:.6f}")

if state.get("error"):
    print(f"Error: {state['error']}")
PY
}

print_status() {
  local config_path
  config_path="$(get_active_config_path)"
  local runtime_dir
  runtime_dir="$(runtime_dir_for_config "${config_path}")"
  refresh_issue_logs >/dev/null 2>&1 || true

  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "Remote offline DQN training is running."
    echo "PID: ${pid}"
    local elapsed_raw
    elapsed_raw="$(ps -p "${pid}" -o etimes= 2>/dev/null | tr -d ' ')"
    if [ -n "${elapsed_raw}" ]; then
      echo "Elapsed: $(format_duration_human "${elapsed_raw}")"
    fi
  else
    echo "Remote offline DQN training is not running."
  fi

  echo "Config: ${config_path}"
  echo "Runtime dir: ${runtime_dir}"
  echo "Log: $(log_file_for_config "${config_path}")"
  echo "Warnings: $(warning_log_file_for_config "${config_path}")"
  echo "Errors: $(error_log_file_for_config "${config_path}")"
  echo "Issues summary: $(issues_summary_file_for_config "${config_path}")"
  echo "State: $(state_file_for_config "${config_path}")"
  echo "Training summary: $(summary_file_for_config "${config_path}")"
  echo "Training progress: $(progress_file_for_config "${config_path}")"
  print_training_summary "${config_path}"
}

start_run() {
  local config_path
  config_path="$(canonicalize_config_path "${1:-${DEFAULT_CONFIG}}")"
  if [ ! -f "${config_path}" ]; then
    echo "Config not found: ${config_path}" >&2
    exit 1
  fi
  if is_running; then
    echo "A remote offline DQN training run is already running."
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
  local generated_config_path
  generated_config_path="$(prepare_generated_config "${config_path}")"

  local log_file
  log_file="$(log_file_for_config "${config_path}")"
  rm -f "$(summary_file_for_config "${config_path}")"
  rm -f "$(progress_file_for_config "${config_path}")"
  rm -f "$(runner_script_for_config "${config_path}")"
  : > "${log_file}"
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

  python3 - "${config_path}" "${generated_config_path}" "$(state_file_for_config "${config_path}")" "${runtime_dir}" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

source_config_path, generated_config_path, state_path, runtime_dir = sys.argv[1:5]
with open(source_config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)
with open(generated_config_path, "r", encoding="utf-8") as handle:
    generated_config = json.load(handle)

state = {
    "status": "running",
    "started_at": datetime.now(timezone.utc).isoformat(),
    "runtime_dir": runtime_dir,
    "config_path": source_config_path,
    "generated_config_path": generated_config_path,
    "dataset_path": generated_config.get("dataset_path"),
    "output_path": generated_config.get("output_path"),
    "summary_output_path": generated_config.get("summary_output_path"),
}
os.makedirs(os.path.dirname(state_path), exist_ok=True)
with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(state, handle, indent=2)
PY

  local cleanup_command="if [ -f '${TELEGRAM_CONTROL_AUTO_FILE}' ]; then bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-stop >/dev/null 2>&1 || true; rm -f '${TELEGRAM_CONTROL_AUTO_FILE}'; fi; exit \$training_status"
  local state_path
  state_path="$(state_file_for_config "${config_path}")"
  local summary_path
  summary_path="$(summary_file_for_config "${config_path}")"
  local runner_script_path
  runner_script_path="$(runner_script_for_config "${config_path}")"
  local merge_command
  merge_command="$(python3 - "${generated_config_path}" <<'PY'
import json
import shlex
import sys

config_path = sys.argv[1]
with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

merge = config.get("dataset_merge") or {}
inputs = merge.get("inputs") or []
dataset_path = config.get("dataset_path")
if inputs:
    args = ["node", "scripts/01-data-generation/dataset/merge-rl-jsonl-datasets.mjs", "--output", dataset_path]
    for value in inputs:
        args.extend(["--input", value])
    print(" ".join(shlex.quote(item) for item in args))
PY
)"

  cat > "${runner_script_path}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

export PATH='${VENV_BIN_DIR}':"\$PATH"
export PYTHONUNBUFFERED='1'
if [ -f '${TELEGRAM_ENV_FILE}' ]; then
  source '${TELEGRAM_ENV_FILE}'
fi
cd '${REPO_ROOT}'

training_status=0

if [ -n "${merge_command}" ]; then
  echo "Preparing merged dataset..."
  eval "${merge_command}"
fi

if '${VENV_PYTHON}' -u scripts/02-training/offline-dqn/train_dqn_offline.py --config '${generated_config_path}'; then
  python3 - '${state_path}' '${summary_path}' <<'PY'
import json
import sys
from datetime import datetime, timezone
state_path, summary_path = sys.argv[1:3]
with open(state_path, 'r', encoding='utf-8') as handle:
    state = json.load(handle)
state['status'] = 'completed'
state['completed_at'] = datetime.now(timezone.utc).isoformat()
state['summary_path'] = summary_path
with open(state_path, 'w', encoding='utf-8') as handle:
    json.dump(state, handle, indent=2)
PY
  node scripts/04-automation/telegram/send-pipeline-notification.mjs --event training_completed --runtime-dir '${runtime_dir}' --training-summary '${summary_path}'
else
  training_status=\$?
  python3 - '${state_path}' <<'PY'
import json
import sys
from datetime import datetime, timezone
state_path = sys.argv[1]
with open(state_path, 'r', encoding='utf-8') as handle:
    state = json.load(handle)
state['status'] = 'failed'
state['completed_at'] = datetime.now(timezone.utc).isoformat()
state['error'] = 'offline DQN training failed; inspect training log and issues summary'
with open(state_path, 'w', encoding='utf-8') as handle:
    json.dump(state, handle, indent=2)
PY
  node scripts/04-automation/telegram/send-pipeline-notification.mjs --event training_failed --runtime-dir '${runtime_dir}' --training-summary '${summary_path}' --error 'offline DQN training failed; inspect training log and issues summary'
fi

${cleanup_command}
EOF
  chmod +x "${runner_script_path}"

  nohup bash "${runner_script_path}" \
    >"${log_file}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  sleep 1

  if kill -0 "${pid}" >/dev/null 2>&1; then
    echo "Started detached offline DQN training with PID ${pid}."
    if [ "${auto_started_telegram_control}" -eq 1 ]; then
      echo "Telegram control bot was started automatically."
    fi
    echo "Log: ${log_file}"
  else
    echo "Process exited immediately. Check log: ${log_file}" >&2
    rm -f "${PID_FILE}"
    python3 - "${state_path}" <<'PY'
import json
import sys
from datetime import datetime, timezone

state_path = sys.argv[1]
with open(state_path, "r", encoding="utf-8") as handle:
    state = json.load(handle)
state["status"] = "failed"
state["completed_at"] = datetime.now(timezone.utc).isoformat()
state["error"] = "training process exited immediately; inspect offline-dqn-training.log"
with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(state, handle, indent=2)
PY
    if [ -f "${TELEGRAM_CONTROL_AUTO_FILE}" ]; then
      bash scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh telegram-control-stop >/dev/null 2>&1 || true
      rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
    fi
    exit 1
  fi
}

stop_run() {
  if ! is_running; then
    echo "No running offline DQN training process found."
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
    --event training_completed \
    --runtime-dir "$(runtime_dir_for_config "${config_path}")" \
    --training-summary "$(summary_file_for_config "${config_path}")"
}

resolve_telegram_poll_interval_seconds() {
  local value="${POKEROGUE_TELEGRAM_POLL_INTERVAL_SECONDS:-${TELEGRAM_POLL_INTERVAL_SECONDS_DEFAULT}}"
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
