#!/usr/bin/env bash
set -euo pipefail

# Modifier-Benchmark auf dem Server (docs/modifier-benchmark-design.md): laeuft die Benchmark-Configs nacheinander ueber
# den Strategic-Remote-Helper, vergleicht sie danach (compare-modifier-policies.ts) und schickt das Ergebnis per Telegram.
# Bereits abgeschlossene Configs werden uebersprungen (Manifest), ein abgebrochener Kettenlauf laesst sich also neu starten.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
HELPER="${REPO_ROOT}/scripts/01-data-generation/pipeline/run-modifier-strategic-seeded-remote.sh"
HELPER_PID_FILE="${REPO_ROOT}/data/rl/pipeline-runs/modifier-strategic-seeded-remote-control/remote-modifier-strategic-seeded.pid"
BENCHMARK_ROOT="${REPO_ROOT}/data/rl/pipeline-runs/modifier-benchmark-control"
CHAIN_PID_FILE="${BENCHMARK_ROOT}/chain.pid"
CHAIN_LOG="${BENCHMARK_ROOT}/chain.log"
COMPARE_DIR="${BENCHMARK_ROOT}/compare"
TELEGRAM_ENV_FILE="${POKEROGUE_NOTIFICATION_ENV_FILE:-${HOME}/.config/pokeroguebot/telegram.env}"
POLL_SECONDS="${POKEROGUE_BENCHMARK_POLL_SECONDS:-60}"

# Reihenfolge: zuerst die kuerzere deterministische Policy. Label = modifier_policy der Config.
BENCHMARK_CONFIGS=(
  "heuristic_v1=data/rl/modifier-benchmark-eval-50seeds-heuristic-v1.json"
  "random_executable=data/rl/modifier-benchmark-eval-50seeds-random.json"
)
BASELINE_LABEL="${POKEROGUE_MODIFIER_BENCHMARK_BASELINE:-random_executable}"
# "label=config,label=config" (Pfade relativ zum Repo) ersetzt die Liste oben (Tests, Versuchsreihen wie
# docs/modifier-learning-findings.md); POKEROGUE_MODIFIER_BENCHMARK_BASELINE setzt das Vergleichs-Label.
if [ -n "${POKEROGUE_MODIFIER_BENCHMARK_CONFIGS:-}" ]; then
  IFS=',' read -r -a BENCHMARK_CONFIGS <<< "${POKEROGUE_MODIFIER_BENCHMARK_CONFIGS}"
fi
BENCHMARK_ROOT="${POKEROGUE_MODIFIER_BENCHMARK_ROOT:-${BENCHMARK_ROOT}}"
CHAIN_PID_FILE="${BENCHMARK_ROOT}/chain.pid"
CHAIN_LOG="${BENCHMARK_ROOT}/chain.log"
COMPARE_DIR="${BENCHMARK_ROOT}/compare"

mkdir -p "${BENCHMARK_ROOT}"

usage() {
  cat <<'EOF'
Usage:
  scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh start    # Kette im Hintergrund starten
  scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh status
  scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh logs
  scripts/03-benchmark/eval/run-modifier-benchmark-remote.sh compare  # nur Auswertung + Telegram (nach Abschluss)
EOF
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

runtime_dir_for() {
  local config_path="$1"
  (cd "${REPO_ROOT}" && node -e '
    const config = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const path = require("path");
    console.log(path.resolve("data/rl", config.output_root));
  ' "${config_path}")
}

is_completed() {
  local runtime_dir="$1"
  [ -f "${runtime_dir}/manifest.json" ] && node -e '
    const manifest = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.exit(manifest.steps?.collect_dataset?.status === "completed" ? 0 : 1);
  ' "${runtime_dir}/manifest.json"
}

helper_running() {
  [ -f "${HELPER_PID_FILE}" ] && kill -0 "$(cat "${HELPER_PID_FILE}")" >/dev/null 2>&1
}

send_telegram() {
  local event="$1"
  local text_file="$2"
  (
    cd "${REPO_ROOT}"
    if [ -f "${TELEGRAM_ENV_FILE}" ]; then
      # shellcheck disable=SC1090
      source "${TELEGRAM_ENV_FILE}"
    fi
    node scripts/04-automation/telegram/send-pipeline-notification.mjs --event "${event}" --text-file "${text_file}"
  ) || log "Telegram notification failed (${event})"
}

fail_chain() {
  local message="$1"
  log "FAILED: ${message}"
  printf 'Modifier-Benchmark abgebrochen\n\n%s\n\nLog: %s\n' "${message}" "${CHAIN_LOG}" > "${BENCHMARK_ROOT}/failure.txt"
  send_telegram "modifier_benchmark_failed" "${BENCHMARK_ROOT}/failure.txt"
  exit 1
}

run_compare() {
  local args=()
  local entry label config_path
  for entry in "${BENCHMARK_CONFIGS[@]}"; do
    label="${entry%%=*}"
    config_path="${REPO_ROOT}/${entry#*=}"
    args+=(--policy "${label}=$(runtime_dir_for "${config_path}")")
  done
  (cd "${REPO_ROOT}" && node scripts/03-benchmark/eval/compare-modifier-policies.ts "${args[@]}" --baseline "${BASELINE_LABEL}" --out "${COMPARE_DIR}")
  send_telegram "modifier_benchmark_completed" "${COMPARE_DIR}/modifier-benchmark-telegram.txt"
}

run_chain() {
  local entry label config_path runtime_dir
  log "Modifier benchmark chain started (commit $(git -C "${REPO_ROOT}" rev-parse --short HEAD))."
  for entry in "${BENCHMARK_CONFIGS[@]}"; do
    label="${entry%%=*}"
    config_path="${REPO_ROOT}/${entry#*=}"
    runtime_dir="$(runtime_dir_for "${config_path}")"
    if is_completed "${runtime_dir}"; then
      log "${label}: already completed (${runtime_dir}), skipping."
      continue
    fi
    while helper_running; do
      log "Another strategic modifier run is active; waiting."
      sleep "${POLL_SECONDS}"
    done
    log "${label}: starting ${config_path}"
    bash "${HELPER}" start "${config_path}" || fail_chain "Start von ${label} fehlgeschlagen (Preflight oder Startfehler)."
    while helper_running; do
      sleep "${POLL_SECONDS}"
    done
    if ! is_completed "${runtime_dir}"; then
      fail_chain "${label}: Lauf beendet, aber collect_dataset ist nicht completed (${runtime_dir})."
    fi
    log "${label}: completed."
  done
  log "Comparing policies."
  run_compare || fail_chain "Auswertung fehlgeschlagen."
  log "Modifier benchmark chain finished."
}

case "${1:-}" in
  start)
    if [ -f "${CHAIN_PID_FILE}" ] && kill -0 "$(cat "${CHAIN_PID_FILE}")" >/dev/null 2>&1; then
      echo "Benchmark chain already running (PID $(cat "${CHAIN_PID_FILE}"))."
      exit 1
    fi
    nohup bash -lc "source ~/.nvm/nvm.sh >/dev/null 2>&1 || true; bash '${SCRIPT_DIR}/run-modifier-benchmark-remote.sh' __chain" > "${CHAIN_LOG}" 2>&1 < /dev/null &
    echo "$!" > "${CHAIN_PID_FILE}"
    echo "Started modifier benchmark chain with PID $!. Log: ${CHAIN_LOG}"
    ;;
  __chain)
    run_chain
    ;;
  status)
    if [ -f "${CHAIN_PID_FILE}" ] && kill -0 "$(cat "${CHAIN_PID_FILE}")" >/dev/null 2>&1; then
      echo "Benchmark chain running (PID $(cat "${CHAIN_PID_FILE}"))."
    else
      echo "Benchmark chain not running."
    fi
    tail -n 5 "${CHAIN_LOG}" 2>/dev/null || true
    bash "${HELPER}" status 2>/dev/null | grep -E "Config:|Current phase|Runs so far" || true
    ;;
  logs)
    tail -n 50 "${CHAIN_LOG}"
    ;;
  compare)
    run_compare
    ;;
  *)
    usage
    exit 1
    ;;
esac
