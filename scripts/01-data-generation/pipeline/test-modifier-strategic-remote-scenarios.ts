// Szenario-Smoke-Tests fuer den Modifier-Strategic-Remote-Helper (laeuft auf dem Server im Repo-Clone).
//
// Gruppen:
//   bot      - quick-smoke, wenn der eigene Control-Bot schon laeuft bzw. ein Control-Bot eines anderen Helpers laeuft
//   failure  - detached `start` mit drei Fehlerbildern:
//              pipeline-timeout: jeder Run ueberschreitet den Prozess-Timeout -> technische Termination mit Failure-Datei
//                und Signatur, Batch `completed`, Pipeline endet mit `no_regular_runs_collected`
//              circuit-breaker: drei Seeds, Notausschalter nach 2 technischen Runs in Folge, dritter Batch startet nicht
//              pipeline-error: fehlender Checkpoint -> systemischer Fehler, weiterhin sofortiger Abbruch (fast-fail)
//              jeweils mit `collection_failed`-Notification (Dry-Run) und automatischem Stoppen des Control-Bots
//   all      - beide Gruppen (Default)
//
// Aufruf: node scripts/01-data-generation/pipeline/test-modifier-strategic-remote-scenarios.ts [bot|failure|all]
// Voraussetzung: kein Collection-Run und kein Telegram-Control-Bot aktiv. Das Skript stoppt nur Bots, die es selbst gestartet hat.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Group = "bot" | "failure" | "all";

type CommandResult = {
  status: number;
  output: string;
};

type FailureScenario = {
  name: string;
  configFile: string;
  // "technical": Runs scheitern einzeln, werden als technische Termination erfasst (Batch completed).
  // "systemic": Fehler vor dem ersten Run, Batch failed (fast-fail).
  mode: "technical" | "systemic";
  expectedError: string;
  expectedBatchStatuses: string[];
};

type ManifestBatch = {
  seed?: string;
  status?: string;
  failure_summary_path?: string | null;
  error_excerpt?: string | null;
  technical_termination_count?: number | null;
};

type Manifest = {
  steps?: Record<string, { status?: string; error?: string | null }>;
  batches?: ManifestBatch[];
};

type TechnicalFailureFile = {
  kind?: string;
  repro?: { command?: string };
  commits?: { repo?: string | null; submodule?: string | null };
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pipelineDir = path.join(repoRoot, "scripts", "01-data-generation", "pipeline");
const modifierHelper = path.join(pipelineDir, "run-modifier-strategic-seeded-remote.sh");
const foreignHelper = path.join(pipelineDir, "run-wave-library-random-collection-remote.sh");
const pipelineRunsDir = path.join(repoRoot, "data", "rl", "pipeline-runs");
const modifierControlDir = path.join(pipelineRunsDir, "modifier-strategic-seeded-remote-control");
const modifierRunPidFile = path.join(modifierControlDir, "remote-modifier-strategic-seeded.pid");
const modifierActiveConfigFile = path.join(modifierControlDir, "active-config.txt");
const modifierTelegramAutoFile = path.join(modifierControlDir, "telegram-control.auto");
const controlBotPattern = "run-telegram-control-bot.mjs";
const runWaitTimeoutMs = 180_000;

const failureScenarios: FailureScenario[] = [
  {
    name: "pipeline-timeout",
    configFile: "modifier-strategic-seeded-remote-scenario-timeout.json",
    mode: "technical",
    expectedError: "no_regular_runs_collected",
    expectedBatchStatuses: ["completed"],
  },
  {
    name: "circuit-breaker",
    configFile: "modifier-strategic-seeded-remote-scenario-circuit-breaker.json",
    mode: "technical",
    expectedError: "technical_failure_threshold_exceeded",
    expectedBatchStatuses: ["completed", "completed", "pending"],
  },
  {
    name: "pipeline-error",
    configFile: "modifier-strategic-seeded-remote-scenario-error.json",
    mode: "systemic",
    expectedError: "Combat DQN checkpoint not found",
    expectedBatchStatuses: ["failed"],
  },
];

const results: string[] = [];
let failed = false;

const group = parseGroup(process.argv[2]);
assertPreconditions();
const previousActiveConfig = existsSync(modifierActiveConfigFile) ? readFileSync(modifierActiveConfigFile, "utf8") : null;

try {
  if (group === "bot" || group === "all") {
    scenarioBotAlreadyRunning();
    scenarioForeignBotRunning();
  }
  if (group === "failure" || group === "all") {
    for (const scenario of failureScenarios) {
      await scenarioPipelineFailure(scenario);
    }
  }
} finally {
  cleanupControlBots();
  if (previousActiveConfig != null) {
    writeFileSync(modifierActiveConfigFile, previousActiveConfig, "utf8");
  }
}

console.log("\nScenario results:");
for (const line of results) {
  console.log(`  ${line}`);
}
console.log(failed ? "SCENARIO SMOKE FAILED" : "SCENARIO SMOKE OK");
process.exit(failed ? 1 : 0);

function scenarioBotAlreadyRunning() {
  const name = "bot-already-running";
  const start = runHelper(modifierHelper, ["telegram-control-start"]);
  if (start.status !== 0) {
    record(false, name, `telegram-control-start failed: ${lastLine(start.output)}`);
    return;
  }
  const smoke = runHelper(modifierHelper, ["quick-smoke"]);
  const stillRunning = isOwnControlBotRunning();
  record(
    smoke.status === 0 && smoke.output.includes("OK control-bot-already-running") && !smoke.output.includes("control-bot-stopped") && stillRunning,
    name,
    `quick-smoke exit=${smoke.status}, reported already-running=${smoke.output.includes("OK control-bot-already-running")}, bot left running=${stillRunning}`,
  );
  runHelper(modifierHelper, ["telegram-control-stop"]);
  record(!isOwnControlBotRunning(), `${name}:cleanup`, "own control bot stopped");
}

function scenarioForeignBotRunning() {
  const name = "bot-foreign-running";
  const start = runHelper(foreignHelper, ["telegram-control-start"]);
  if (start.status !== 0) {
    record(false, name, `foreign telegram-control-start failed: ${lastLine(start.output)}`);
    return;
  }
  const smoke = runHelper(modifierHelper, ["quick-smoke"]);
  const ownStarted = isOwnControlBotRunning();
  const foreignStillRunning = findControlBotPids().length > 0;
  record(
    smoke.status === 1 && smoke.output.includes("FAIL control-bot-foreign-running") && !ownStarted && foreignStillRunning,
    name,
    `quick-smoke exit=${smoke.status}, reported foreign=${smoke.output.includes("FAIL control-bot-foreign-running")}, own bot started=${ownStarted}, foreign left running=${foreignStillRunning}`,
  );
  runHelper(foreignHelper, ["telegram-control-stop"]);
  record(findControlBotPids().length === 0, `${name}:cleanup`, "foreign control bot stopped");
}

async function scenarioPipelineFailure(scenario: FailureScenario) {
  const configPath = path.join(repoRoot, "data", "rl", scenario.configFile);
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { output_root: string };
  const runtimeDir = path.resolve(path.dirname(configPath), config.output_root);
  rmSync(runtimeDir, { recursive: true, force: true });

  const start = runHelper(modifierHelper, ["start", configPath], {
    POKEROGUE_SKIP_PREFLIGHT: "1",
    POKEROGUE_TELEGRAM_DRY_RUN: "1",
  });
  // Scheitert der Lauf innerhalb der ersten Sekunde (z. B. Config-Fehler), meldet `start` das direkt mit Exit-Code 1,
  // stoppt den Control-Bot selbst und gibt die Auto-Start-Meldung nicht aus. Beide Wege sind gueltig.
  const exitedImmediately = start.status !== 0 && start.output.includes("Process exited immediately");
  const botAutoStarted = exitedImmediately || start.output.includes("Telegram control bot was started automatically.");
  if (start.status !== 0 && !exitedImmediately) {
    record(false, scenario.name, `start failed: ${lastLine(start.output)}`);
    return;
  }

  const finished = await waitForRunToFinish();
  if (!finished) {
    runHelper(modifierHelper, ["stop"]);
    record(false, scenario.name, `run did not finish within ${runWaitTimeoutMs / 1000}s`);
    return;
  }

  const manifest = readJson<Manifest>(path.join(runtimeDir, "manifest.json"));
  const batches = manifest?.batches ?? [];
  const batch = batches[0];
  const log = readTextIfExists(path.join(runtimeDir, "remote-modifier-strategic.log"));

  const checks: Array<[string, boolean]> = [
    ["collect_dataset failed", manifest?.steps?.collect_dataset?.status === "failed"],
    [
      `batch statuses ${scenario.expectedBatchStatuses.join("/")}`,
      batches.map(entry => entry.status).join("/") === scenario.expectedBatchStatuses.join("/"),
    ],
    ["collection_failed dry run", log.includes("Telegram dry run for event: collection_failed")],
    ["control bot auto-started", botAutoStarted],
    ["control bot auto-stopped", !isOwnControlBotRunning() && !existsSync(modifierTelegramAutoFile)],
  ];

  if (scenario.mode === "systemic") {
    const failureSummaryPath = batch?.failure_summary_path ?? null;
    const failureSummary = failureSummaryPath && existsSync(failureSummaryPath) ? readFileSync(failureSummaryPath, "utf8") : "";
    checks.push(
      ["failure summary has expected error", failureSummary.includes(scenario.expectedError)],
      ["error excerpt has expected error", (batch?.error_excerpt ?? "").includes(scenario.expectedError)],
    );
  } else {
    const failureFile = batch?.seed
      ? readJson<TechnicalFailureFile>(
        path.join(runtimeDir, "collect_dataset", "technical-failures", `${batch.seed.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")}--run-0.json`),
      )
      : null;
    const signatures = readJson<{ signature_count?: number }>(
      path.join(runtimeDir, "collect_dataset", "technical-failure-signatures.json"),
    );
    checks.push(
      ["step error has expected reason", (manifest?.steps?.collect_dataset?.error ?? "").includes(scenario.expectedError)],
      ["technical termination counted", batch?.technical_termination_count === 1],
      ["failure file with process timeout", failureFile?.kind === "collector_run_process_timeout"],
      ["failure file has repro command", (failureFile?.repro?.command ?? "").includes("repro-technical-failure.ts")],
      ["failure file has commits", typeof failureFile?.commits?.repo === "string" && typeof failureFile?.commits?.submodule === "string"],
      ["signatures written", (signatures?.signature_count ?? 0) >= 1],
      ["notification shows technical failures", log.includes("Technical failures:")],
    );
  }
  const failedChecks = checks.filter(([, ok]) => !ok).map(([label]) => label);
  record(
    failedChecks.length === 0,
    scenario.name,
    failedChecks.length === 0
      ? `expected "${scenario.expectedError}" handled${exitedImmediately ? " (start reported immediate exit)" : ""}`
      : `failed checks: ${failedChecks.join(", ")} (runtime: ${runtimeDir})`,
  );
}

function assertPreconditions() {
  if (isPidFileAlive(modifierRunPidFile)) {
    console.error("A strategic modifier collection run is active. Aborting scenario tests.");
    process.exit(1);
  }
  const pids = findControlBotPids();
  if (pids.length > 0) {
    console.error(`Telegram control bot(s) already running (PIDs: ${pids.join(", ")}). Stop them first; aborting.`);
    process.exit(1);
  }
}

function cleanupControlBots() {
  if (findControlBotPids().length === 0) {
    return;
  }
  runHelper(modifierHelper, ["telegram-control-stop"]);
  runHelper(foreignHelper, ["telegram-control-stop"]);
  const leftover = findControlBotPids();
  if (leftover.length > 0) {
    record(false, "cleanup", `control bot(s) still running: ${leftover.join(", ")}`);
  }
}

async function waitForRunToFinish(): Promise<boolean> {
  const deadline = Date.now() + runWaitTimeoutMs;
  while (Date.now() < deadline) {
    if (!isPidFileAlive(modifierRunPidFile)) {
      // Dem Cleanup-Kommando des detached Laufs (Control-Bot stoppen) kurz Zeit geben.
      await sleep(3000);
      return true;
    }
    await sleep(5000);
  }
  return false;
}

function isOwnControlBotRunning(): boolean {
  return findControlBotPids().some(pid => readCommandLine(pid).includes(modifierControlDir));
}

function findControlBotPids(): number[] {
  const result = spawnSync("pgrep", ["-f", controlBotPattern], { encoding: "utf8" });
  return result.stdout
    .split("\n")
    .map(line => Number.parseInt(line.trim(), 10))
    .filter(pid => Number.isInteger(pid) && pid !== process.pid && readCommandLine(pid).includes(`node scripts/04-automation/telegram/${controlBotPattern}`));
}

function readCommandLine(pid: number): string {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
  } catch {
    return "";
  }
}

function isPidFileAlive(pidFile: string): boolean {
  if (!existsSync(pidFile)) {
    return false;
  }
  const pid = Number.parseInt(readFileSync(pidFile, "utf8").trim(), 10);
  if (!Number.isInteger(pid)) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runHelper(helper: string, args: string[], extraEnv: Record<string, string> = {}): CommandResult {
  const result = spawnSync("bash", [helper, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function readTextIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function record(ok: boolean, name: string, detail: string) {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}: ${detail}`);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${detail}`);
  if (!ok) {
    failed = true;
  }
}

function lastLine(text: string): string {
  return text.trim().split("\n").at(-1) ?? "";
}

function parseGroup(value: string | undefined): Group {
  if (value == null || value === "all" || value === "bot" || value === "failure") {
    return value ?? "all";
  }
  console.error(`Unknown group: ${value}. Use bot, failure or all.`);
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
