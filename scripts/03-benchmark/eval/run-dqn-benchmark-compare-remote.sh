#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEFAULT_CONFIG="${REPO_ROOT}/data/rl/benchmark-dqn-wave-library-v3-compare.json"
CONTROL_DIR="${REPO_ROOT}/data/rl/benchmark-runs/dqn-compare-remote-control"
PID_FILE="${CONTROL_DIR}/remote-dqn-benchmark.pid"
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
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh start [config_path]
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh status
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh logs
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh last
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh issues
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh notify-test
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-start
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-status
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-stop
  scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh stop
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
if isinstance(runtime_dir, str) and runtime_dir:
    if os.path.isabs(runtime_dir):
        print(os.path.realpath(runtime_dir))
    else:
        print(os.path.realpath(os.path.join(repo_root, runtime_dir)))
    raise SystemExit(0)

config_base = os.path.splitext(os.path.basename(config_path))[0]
print(os.path.realpath(os.path.join(repo_root, "data", "rl", "benchmark-runs", config_base)))
PY
}

runtime_path() {
  local config_path="$1"
  local file_name="$2"
  echo "$(runtime_dir_for_config "${config_path}")/${file_name}"
}

log_file_for_config() { runtime_path "${1}" "benchmark.log"; }
error_log_file_for_config() { runtime_path "${1}" "benchmark-errors.log"; }
warning_log_file_for_config() { runtime_path "${1}" "benchmark-warnings.log"; }
issues_summary_file_for_config() { runtime_path "${1}" "issues-summary.txt"; }
summary_file_for_config() { runtime_path "${1}" "benchmark-summary.json"; }
state_file_for_config() { runtime_path "${1}" "benchmark-state.json"; }
runner_script_for_config() { runtime_path "${1}" "run-benchmark.sh"; }

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

  echo "Running RL policy contract tests..."
  (
    cd "${REPO_ROOT}"
    npm run rl:test:policy-contract
  )

  echo "Running benchmark config validation..."
  python3 - "${config_path}" "${REPO_ROOT}" <<'PY'
import json
import os
import sys

config_path = sys.argv[1]
repo_root = sys.argv[2]
config_dir = os.path.dirname(config_path)

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

collector_config_path = config.get("collector_config_path")
if not isinstance(collector_config_path, str) or not collector_config_path:
    raise SystemExit("Missing collector_config_path in benchmark config")

benchmarks = config.get("benchmarks")
if not isinstance(benchmarks, list) or not benchmarks:
    raise SystemExit("Benchmark config requires a non-empty benchmarks list")

def resolve_path(value):
    if os.path.isabs(value):
        return os.path.realpath(value)
    return os.path.realpath(os.path.join(repo_root, value))

print(f"Validated config: collector_config_path={collector_config_path}")
print(f"Validated config: benchmarks={len(benchmarks)}")

for benchmark in benchmarks:
    label = benchmark.get("label")
    checkpoint = benchmark.get("checkpoint")
    report_path = benchmark.get("report_path")
    if not isinstance(label, str) or not label:
        raise SystemExit("Each benchmark entry requires a label")
    if not isinstance(checkpoint, str) or not checkpoint:
        raise SystemExit(f"Benchmark '{label}' missing checkpoint")
    if not isinstance(report_path, str) or not report_path:
        raise SystemExit(f"Benchmark '{label}' missing report_path")
    checkpoint_path = resolve_path(checkpoint)
    if not os.path.exists(checkpoint_path):
        raise SystemExit(f"Checkpoint for benchmark '{label}' not found: {checkpoint_path}")
    print(f"Validated benchmark: {label} -> {checkpoint}")
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

print_benchmark_summary() {
  local config_path="$1"
  python3 - "$(state_file_for_config "${config_path}")" "$(summary_file_for_config "${config_path}")" "$(log_file_for_config "${config_path}")" <<'PY'
import json
import re
import sys
from pathlib import Path

state_path = Path(sys.argv[1])
summary_path = Path(sys.argv[2])
log_path = Path(sys.argv[3])

state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}

print(f"Benchmark state: {state.get('status', 'not_started')}")
total = state.get("benchmarks_total")
completed = state.get("completed_benchmarks")
current = state.get("current_label")
if total is not None:
    print(f"Benchmarks: {completed if completed is not None else 0}/{total}")
if current:
    print(f"Current benchmark: {current}")

rows = summary.get("benchmarks") if isinstance(summary.get("benchmarks"), list) else []
if rows:
    latest = rows[-1]
    print(f"Latest result: {latest.get('label')} win_rate={latest.get('win_rate'):.3f} avg_reward={latest.get('avg_reward'):.4f} avg_turns={latest.get('avg_turns'):.2f}")
    runtime_ms = summary.get("total_runtime_ms")
    if isinstance(runtime_ms, int):
        print(f"Total runtime ms: {runtime_ms}")
    raise SystemExit(0)

pattern = re.compile(r"benchmark_completed label=(\\S+) win_rate=([0-9.]+) avg_reward=([-0-9.]+) avg_turns=([0-9.]+)")
latest = None
if log_path.exists():
    for raw_line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = pattern.search(raw_line)
        if match:
            latest = match.groups()
if latest:
    label, win_rate, avg_reward, avg_turns = latest
    print(f"Latest result: {label} win_rate={float(win_rate):.3f} avg_reward={float(avg_reward):.4f} avg_turns={float(avg_turns):.2f}")

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
    echo "Remote DQN benchmark compare run is running."
    echo "PID: ${pid}"
    local elapsed_raw
    elapsed_raw="$(ps -p "${pid}" -o etimes= 2>/dev/null | tr -d ' ')"
    if [ -n "${elapsed_raw}" ]; then
      echo "Elapsed: $(format_duration_human "${elapsed_raw}")"
    fi
  else
    echo "Remote DQN benchmark compare run is not running."
  fi

  echo "Config: ${config_path}"
  echo "Runtime dir: ${runtime_dir}"
  echo "Log: $(log_file_for_config "${config_path}")"
  echo "Warnings: $(warning_log_file_for_config "${config_path}")"
  echo "Errors: $(error_log_file_for_config "${config_path}")"
  echo "Issues summary: $(issues_summary_file_for_config "${config_path}")"
  echo "State: $(state_file_for_config "${config_path}")"
  echo "Benchmark summary: $(summary_file_for_config "${config_path}")"
  print_benchmark_summary "${config_path}"
}

start_run() {
  local config_path
  config_path="$(canonicalize_config_path "${1:-${DEFAULT_CONFIG}}")"
  if [ ! -f "${config_path}" ]; then
    echo "Config not found: ${config_path}" >&2
    exit 1
  fi
  if is_running; then
    echo "A remote DQN benchmark compare run is already running."
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
  rm -f "$(summary_file_for_config "${config_path}")"
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

  python3 - "${config_path}" "$(state_file_for_config "${config_path}")" "${runtime_dir}" "$(summary_file_for_config "${config_path}")" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

config_path, state_path, runtime_dir, summary_path = sys.argv[1:5]
with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

state = {
    "status": "running",
    "started_at": datetime.now(timezone.utc).isoformat(),
    "runtime_dir": runtime_dir,
    "config_path": config_path,
    "collector_config_path": config.get("collector_config_path"),
    "benchmarks_total": len(config.get("benchmarks") or []),
    "completed_benchmarks": 0,
    "current_label": None,
    "benchmark_summary_path": summary_path,
}
os.makedirs(os.path.dirname(state_path), exist_ok=True)
with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(state, handle, indent=2)

with open(summary_path, "w", encoding="utf-8") as handle:
    json.dump({"benchmarks": []}, handle, indent=2)
    handle.write("\n")
PY

  local cleanup_command="if [ -f '${TELEGRAM_CONTROL_AUTO_FILE}' ]; then bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-stop >/dev/null 2>&1 || true; rm -f '${TELEGRAM_CONTROL_AUTO_FILE}'; fi; exit \$benchmark_status"
  local state_path
  state_path="$(state_file_for_config "${config_path}")"
  local summary_path
  summary_path="$(summary_file_for_config "${config_path}")"
  local runner_script_path
  runner_script_path="$(runner_script_for_config "${config_path}")"

  cat > "${runner_script_path}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

export PATH='${VENV_BIN_DIR}':"\$PATH"
export PYTHONUNBUFFERED='1'
if [ -f '${TELEGRAM_ENV_FILE}' ]; then
  source '${TELEGRAM_ENV_FILE}'
fi
cd '${REPO_ROOT}'

benchmark_status=0

if python3 - '${config_path}' '${summary_path}' '${state_path}' '${REPO_ROOT}' <<'PY'
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

config_path, summary_path, state_path, repo_root = sys.argv[1:5]
config_path = os.path.realpath(config_path)
summary_path = os.path.realpath(summary_path)
state_path = os.path.realpath(state_path)
repo_root = os.path.realpath(repo_root)
config_dir = os.path.dirname(config_path)

with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)

collector_config = config["collector_config_path"]
device = config.get("device", "cpu")
parallelism = int(config.get("parallelism", 1))
max_steps_per_episode = int(config.get("max_steps_per_episode", 400))
max_truncated_rate = float(config.get("max_truncated_rate", 0.1))
reuse_baselines = config.get("reuse_baselines", True) is True
benchmarks = config.get("benchmarks") or []

baseline_random_path = os.path.join(repo_root, "data", "rl", "combat", "eval-random-benchmarked.jsonl")
baseline_always_path = os.path.join(repo_root, "data", "rl", "combat", "eval-always_move_0-benchmarked.jsonl")

def resolve_path(value):
    if os.path.isabs(value):
        return os.path.realpath(value)
    return os.path.realpath(os.path.join(repo_root, value))

def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)

def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\\n")

def subtract_nullable(left, right):
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return left - right
    return None

def build_row(label, checkpoint_path, report_path, report, reuse_used):
    dqn = report.get("results", {}).get("dqn", {})
    return {
        "label": label,
        "checkpoint": checkpoint_path,
        "report_path": report_path,
        "win_rate": dqn.get("win_rate"),
        "avg_reward": dqn.get("avg_reward"),
        "avg_turns": dqn.get("avg_turns"),
        "truncated_rate": dqn.get("truncated_rate"),
        "episodes": dqn.get("episodes"),
        "transitions": dqn.get("transitions"),
        "reuse_baselines_used": reuse_used,
    }

def enrich_rows(rows):
    if not rows:
        return rows
    baseline = rows[0]
    previous = None
    enriched = []
    for row in rows:
        current = dict(row)
        current["delta_vs_first"] = None if row is baseline else {
            "win_rate": subtract_nullable(current.get("win_rate"), baseline.get("win_rate")),
            "avg_reward": subtract_nullable(current.get("avg_reward"), baseline.get("avg_reward")),
            "avg_turns": subtract_nullable(current.get("avg_turns"), baseline.get("avg_turns")),
            "truncated_rate": subtract_nullable(current.get("truncated_rate"), baseline.get("truncated_rate")),
        }
        current["delta_vs_previous"] = None if previous is None else {
            "win_rate": subtract_nullable(current.get("win_rate"), previous.get("win_rate")),
            "avg_reward": subtract_nullable(current.get("avg_reward"), previous.get("avg_reward")),
            "avg_turns": subtract_nullable(current.get("avg_turns"), previous.get("avg_turns")),
            "truncated_rate": subtract_nullable(current.get("truncated_rate"), previous.get("truncated_rate")),
        }
        enriched.append(current)
        previous = current
    return enriched

state = load_json(state_path)
summary = load_json(summary_path)
rows = summary.get("benchmarks") if isinstance(summary.get("benchmarks"), list) else []
start_time = time.time()
baseline_ready = os.path.exists(baseline_random_path) and os.path.exists(baseline_always_path)

for index, benchmark in enumerate(benchmarks, start=1):
    label = benchmark["label"]
    checkpoint_path = resolve_path(benchmark["checkpoint"])
    report_path = resolve_path(benchmark["report_path"])

    state["current_label"] = label
    state["completed_benchmarks"] = len(rows)
    write_json(state_path, state)

    reuse_used = reuse_baselines and baseline_ready
    command = [
        "python3",
        "scripts/03-benchmark/eval/eval_policy_compare.py",
        "--collector-config",
        collector_config,
        "--checkpoint",
        checkpoint_path,
        "--device",
        device,
        "--report-path",
        report_path,
        "--max-steps-per-episode",
        str(max_steps_per_episode),
        "--max-truncated-rate",
        str(max_truncated_rate),
        "--parallelism",
        str(parallelism),
    ]
    if reuse_used:
        command.append("--reuse-baselines")

    print(f"benchmark_start label={label} checkpoint={checkpoint_path} reuse_baselines={str(reuse_used).lower()}")
    subprocess.run(command, cwd=repo_root, check=True)

    report = load_json(report_path)
    row = build_row(label, checkpoint_path, report_path, report, reuse_used)
    rows.append(row)
    baseline_ready = True

    total_runtime_ms = int((time.time() - start_time) * 1000)
    summary_payload = {
        "collector_config_path": collector_config,
        "runtime_dir": os.path.dirname(summary_path),
        "total_runtime_ms": total_runtime_ms,
        "benchmarks": enrich_rows(rows),
    }
    write_json(summary_path, summary_payload)

    state["completed_benchmarks"] = len(rows)
    state["current_label"] = None
    state["latest_label"] = label
    write_json(state_path, state)

    print(
        "benchmark_completed "
        f"label={label} "
        f"win_rate={float(row['win_rate'] or 0.0):.3f} "
        f"avg_reward={float(row['avg_reward'] or 0.0):.4f} "
        f"avg_turns={float(row['avg_turns'] or 0.0):.2f}"
    )

state["completed_benchmarks"] = len(rows)
state["current_label"] = None
state["status"] = "completed"
state["completed_at"] = datetime.now(timezone.utc).isoformat()
write_json(state_path, state)

summary_payload = load_json(summary_path)
summary_payload["total_runtime_ms"] = int((time.time() - start_time) * 1000)
write_json(summary_path, summary_payload)
PY
then
  node scripts/04-automation/telegram/send-pipeline-notification.mjs --event benchmark_completed --runtime-dir '${runtime_dir}' --benchmark-summary '${summary_path}'
else
  benchmark_status=\$?
  python3 - '${state_path}' <<'PY'
import json
import sys
from datetime import datetime, timezone
state_path = sys.argv[1]
with open(state_path, 'r', encoding='utf-8') as handle:
    state = json.load(handle)
state['status'] = 'failed'
state['completed_at'] = datetime.now(timezone.utc).isoformat()
state['error'] = 'DQN benchmark compare failed; inspect benchmark log and issues summary'
with open(state_path, 'w', encoding='utf-8') as handle:
    json.dump(state, handle, indent=2)
    handle.write('\n')
PY
  node scripts/04-automation/telegram/send-pipeline-notification.mjs --event benchmark_failed --runtime-dir '${runtime_dir}' --benchmark-summary '${summary_path}' --error 'DQN benchmark compare failed; inspect benchmark log and issues summary'
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
    echo "Started detached DQN benchmark compare run with PID ${pid}."
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
state["error"] = "benchmark process exited immediately; inspect benchmark.log"
with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(state, handle, indent=2)
    handle.write("\n")
PY
    if [ -f "${TELEGRAM_CONTROL_AUTO_FILE}" ]; then
      bash scripts/03-benchmark/eval/run-dqn-benchmark-compare-remote.sh telegram-control-stop >/dev/null 2>&1 || true
      rm -f "${TELEGRAM_CONTROL_AUTO_FILE}"
    fi
    exit 1
  fi
}

stop_run() {
  if ! is_running; then
    echo "No running DQN benchmark compare process found."
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
  tail -n 80 "$(log_file_for_config "${config_path}")"
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
    --event benchmark_completed \
    --runtime-dir "$(runtime_dir_for_config "${config_path}")" \
    --benchmark-summary "$(summary_file_for_config "${config_path}")"
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
