import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "modifier-fixed-seed-collector.test.template.ts");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", runId);

const defaultOutputPath = path.join(repoRoot, "data", "temp", "rl", "modifier-strategic-fixed-seed-collector.json");
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputPath;
const seed = process.argv[3] ?? "modifier-strategic-fixed-seed";
const runCount = Number.parseInt(process.argv[4] ?? "", 10) || 10;
const maxWaves = Number.parseInt(process.argv[5] ?? "", 10) || 10;
const modifierPolicy = process.argv[6] ?? "random_executable";
const collectorVariant = "strategic_fixed_seed";
const stepTimeoutMs = Number.parseInt(process.argv[10] ?? "", 10)
  || Number.parseInt(process.env.POKEROGUE_MODIFIER_STEP_TIMEOUT_MS ?? "", 10)
  || 15000;
const runProcessTimeoutMs = Number.parseInt(process.argv[11] ?? "", 10)
  || Number.parseInt(process.env.POKEROGUE_MODIFIER_RUN_TIMEOUT_MS ?? "", 10)
  || 300000;
const runIndexBase = Number.parseInt(process.argv[12] ?? "", 10)
  || Number.parseInt(process.env.POKEROGUE_MODIFIER_RUN_INDEX_BASE ?? "", 10)
  || 0;
const defaultCombatCheckpointCandidates = [
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-longer.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-conservative.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-6800-stable.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-3400.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-bootstrap-combined-960.pt"),
] as const;
const defaultPythonCandidates = [
  path.join(repoRoot, ".venv", "bin", "python"),
  path.join(repoRoot, ".venv", "bin", "python3"),
] as const;
function resolveFirstExisting(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function normalizeOptionalCliArg(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const checkpointOverride = normalizeOptionalCliArg(process.argv[7]);
const combatDeviceOverride = normalizeOptionalCliArg(process.argv[8]);
const pythonOverride = normalizeOptionalCliArg(process.argv[9]) ?? process.env.POKEROGUE_COMBAT_DQN_PYTHON ?? null;

const combatCheckpoint = checkpointOverride
  ? path.resolve(checkpointOverride)
  : process.env.POKEROGUE_COMBAT_DQN_CHECKPOINT
  ? path.resolve(process.env.POKEROGUE_COMBAT_DQN_CHECKPOINT)
  : resolveFirstExisting(defaultCombatCheckpointCandidates);
const combatDevice = combatDeviceOverride ?? process.env.POKEROGUE_COMBAT_DQN_DEVICE ?? "cpu";
const pythonBin = pythonOverride
  ? (path.isAbsolute(pythonOverride) ? pythonOverride : pythonOverride)
  : resolveFirstExisting(defaultPythonCandidates) ?? "python3";
const combatInferWorkerScript = path.join(repoRoot, "scripts", "02-training", "inference", "dqn_policy_infer_worker.py");

function cleanup(): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

if (!existsSync(templatePath)) {
  throw new Error(`Collector template not found: ${templatePath}`);
}
if (!combatCheckpoint || !existsSync(combatCheckpoint)) {
  throw new Error(
    "Combat DQN checkpoint not found. Provide it as argv[7] or env POKEROGUE_COMBAT_DQN_CHECKPOINT. "
    + `Checked defaults: ${defaultCombatCheckpointCandidates.join(", ")}`,
  );
}
if (!existsSync(combatInferWorkerScript)) {
  throw new Error(`Combat DQN worker script not found: ${combatInferWorkerScript}`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(tempDir, { recursive: true });

const templateSource = readFileSync(templatePath, "utf8");

const runnerEnv = {
  ...process.env,
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}`,
};

type EpisodeSummary = {
  run_index: number;
  wave_reached: number;
  total_reward: number;
  termination_reason?: string;
  decision_rng_seed?: string;
  timeout_debug?: Record<string, unknown>;
  error_debug?: Record<string, unknown>;
};

// Ein technisch beendeter Run: er landet nicht in episodes[], sondern hier, damit die Pipeline
// eine Failure-Datei mit Repro-Infos schreiben kann. episode ist das vollstaendige Episoden-JSON,
// soweit der Run eines geschrieben hat (sonst null, z. B. bei Prozess-Timeout).
type TechnicalTermination = {
  run_index: number;
  kind: string;
  reason: string;
  exit_code: number | null;
  signal: string | null;
  episode: EpisodeSummary | null;
};

type CollectorPayload = {
  schema_version: string;
  seed: string;
  run_count: number;
  max_waves: number;
  collector_variant: string;
  worker_id: string;
  starter_config_id: string;
  starter_species: string[];
  decision_rng_strategy: string;
  step_timeout_ms: number;
  modifier_policy: string;
  combat_dqn_checkpoint: string;
  combat_dqn_device: string;
  generated_at: string;
  summary?: {
    average_wave_reached: number | null;
    average_total_reward: number | null;
    best_wave_reached: number | null;
    worst_wave_reached: number | null;
  };
  episodes: EpisodeSummary[];
  regular_run_count?: number;
  technical_termination_count?: number;
  technical_terminations?: TechnicalTermination[];
};

type RunOutcome =
  | { status: "regular"; payload: CollectorPayload }
  | { status: "technical"; payload: CollectorPayload | null; termination: TechnicalTermination };

function buildTestSource(runOutputPath: string, runIndexOffset: number): string {
  return templateSource
    .replaceAll("__OUTPUT_PATH__", JSON.stringify(runOutputPath))
    .replaceAll("__SEED__", JSON.stringify(seed))
    .replaceAll("__RUN_COUNT__", "1")
    .replaceAll("__RUN_INDEX_OFFSET__", String(runIndexOffset))
    .replaceAll("__MAX_WAVES__", String(maxWaves))
    .replaceAll("__COLLECTOR_VARIANT__", JSON.stringify(collectorVariant))
    .replaceAll("__MODIFIER_POLICY__", JSON.stringify(modifierPolicy))
    .replaceAll("__COMBAT_DQN_CHECKPOINT__", JSON.stringify(combatCheckpoint))
    .replaceAll("__COMBAT_DQN_DEVICE__", JSON.stringify(combatDevice))
    .replaceAll("__COMBAT_DQN_PYTHON__", JSON.stringify(pythonBin))
    .replaceAll("__COMBAT_DQN_WORKER_SCRIPT__", JSON.stringify(combatInferWorkerScript))
    .replaceAll("__STEP_TIMEOUT_MS__", String(stepTimeoutMs));
}

function isTechnicalTerminationReason(reason: string | undefined): boolean {
  if (!reason) {
    return true;
  }

  if (reason === "max_waves_reached" || reason === "team_wipe_or_game_over") {
    return false;
  }

  if (reason === "combat_terminal:GameOverPhase" || reason === "combat_terminal:PostGameOverPhase" || reason === "combat_terminal:TitlePhase") {
    return false;
  }

  return true;
}

function firstLine(value: string, maxLength = 240): string {
  return (value.split("\n")[0] ?? "").trim().slice(0, maxLength);
}

function readRunPayload(runOutputPath: string): CollectorPayload | null {
  if (!existsSync(runOutputPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(runOutputPath, "utf8")) as CollectorPayload;
  } catch {
    return null;
  }
}

function runSingleCollectorBatch(runIndex: number): RunOutcome {
  const runTempRelativeDir = path.join("test", ".external-rl", runId, `run-${runIndex}`);
  const runTempDir = path.join(pokerogueRoot, runTempRelativeDir);
  const runTempTestRelativePath = path.join(runTempRelativeDir, "modifier-strategic-fixed-seed-collector.test.ts");
  const runTempTestPath = path.join(pokerogueRoot, runTempTestRelativePath);
  const runOutputPath = path.join(tempDir, `run-${runIndex}.json`);
  const globalRunIndex = runIndexBase + runIndex;

  mkdirSync(runTempDir, { recursive: true });
  writeFileSync(runTempTestPath, buildTestSource(runOutputPath, globalRunIndex), { encoding: "utf8" });

  console.log(`[modifier-strategic-fixed-seed-runner] starting run ${runIndex + 1}/${runCount}`);
  const result = spawnSync(
    pokerogueVitestBin,
    ["run", runTempTestRelativePath, "--no-isolate"],
    {
      cwd: pokerogueRoot,
      env: runnerEnv,
      stdio: "inherit",
      timeout: runProcessTimeoutMs,
      killSignal: "SIGKILL",
    },
  );

  const exitCode = result.status ?? null;
  const signal = result.signal ?? null;
  const payload = readRunPayload(runOutputPath);
  const episode = payload && Array.isArray(payload.episodes) && payload.episodes.length === 1 ? payload.episodes[0]! : null;
  const technical = (kind: string, reason: string): RunOutcome => {
    console.error(
      `[modifier-strategic-fixed-seed-runner] technical termination run=${globalRunIndex} kind=${kind} reason=${reason} exit=${exitCode ?? "none"} signal=${signal ?? "none"}`,
    );
    return {
      status: "technical",
      payload,
      termination: { run_index: globalRunIndex, kind, reason, exit_code: exitCode, signal, episode },
    };
  };

  if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT") {
    return technical("collector_run_process_timeout", `run_process_timeout_ms_exceeded:${runProcessTimeoutMs}`);
  }
  if (result.error) {
    return technical("collector_run_failed", `spawn_error:${firstLine(String(result.error.message ?? result.error))}`);
  }
  if (payload == null) {
    return technical("collector_run_missing_output", exitCode === 0 ? "missing_or_invalid_run_output" : `missing_run_output:exit_${exitCode ?? "none"}`);
  }
  if (episode == null) {
    return technical("collector_run_invalid_episode_count", `episode_count:${payload.episodes?.length ?? "unknown"}`);
  }
  if (isTechnicalTerminationReason(episode.termination_reason)) {
    return technical("collector_run_technical_termination", firstLine(episode.termination_reason ?? "unknown"));
  }
  if (exitCode !== 0) {
    return technical("collector_run_failed", `vitest_exit_${exitCode ?? "none"}`);
  }

  console.log(
    `[modifier-strategic-fixed-seed-runner] finished run ${runIndex + 1}/${runCount} wave=${episode.wave_reached ?? "unknown"} reward=${episode.total_reward ?? "unknown"} termination=${episode.termination_reason ?? "unknown"}`,
  );
  return { status: "regular", payload };
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

try {
  const outcomes: RunOutcome[] = [];

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    outcomes.push(runSingleCollectorBatch(runIndex));
  }

  const regularPayloads = outcomes.flatMap(outcome => outcome.status === "regular" ? [outcome.payload] : []);
  const technicalTerminations = outcomes.flatMap(outcome => outcome.status === "technical" ? [outcome.termination] : []);
  // Metadaten aus dem ersten Run, der ueberhaupt eine Ausgabe geschrieben hat; sonst aus den CLI-Argumenten.
  const metadataPayload = regularPayloads[0] ?? outcomes.map(outcome => outcome.payload).find(payload => payload != null) ?? null;

  const episodes = regularPayloads.flatMap(payload => payload.episodes);
  const waves = episodes.map(episode => episode.wave_reached);

  const aggregatedPayload: CollectorPayload = {
    schema_version: metadataPayload?.schema_version ?? "unknown",
    seed,
    run_count: runCount,
    max_waves: maxWaves,
    collector_variant: metadataPayload?.collector_variant ?? collectorVariant,
    worker_id: metadataPayload?.worker_id ?? "unknown",
    starter_config_id: metadataPayload?.starter_config_id ?? "unknown",
    starter_species: metadataPayload?.starter_species ?? [],
    decision_rng_strategy: metadataPayload?.decision_rng_strategy ?? "seed_plus_run_index",
    step_timeout_ms: metadataPayload?.step_timeout_ms ?? stepTimeoutMs,
    modifier_policy: metadataPayload?.modifier_policy ?? modifierPolicy,
    combat_dqn_checkpoint: metadataPayload?.combat_dqn_checkpoint ?? combatCheckpoint,
    combat_dqn_device: metadataPayload?.combat_dqn_device ?? combatDevice,
    generated_at: new Date().toISOString(),
    summary: {
      average_wave_reached: average(waves),
      average_total_reward: average(episodes.map(episode => episode.total_reward)),
      best_wave_reached: waves.length > 0 ? Math.max(...waves) : null,
      worst_wave_reached: waves.length > 0 ? Math.min(...waves) : null,
    },
    episodes,
    regular_run_count: episodes.length,
    technical_termination_count: technicalTerminations.length,
    technical_terminations: technicalTerminations,
  };

  writeFileSync(outputPath, JSON.stringify(aggregatedPayload, null, 2), { encoding: "utf8" });

  console.log("Modifier strategic fixed-seed collector output:", outputPath);
  console.log("Seed:", aggregatedPayload.seed);
  console.log("Runs:", aggregatedPayload.run_count);
  console.log("Regular runs:", aggregatedPayload.regular_run_count);
  console.log("Technical terminations:", aggregatedPayload.technical_termination_count);
  console.log("Max waves:", aggregatedPayload.max_waves);
  console.log("Collector variant:", aggregatedPayload.collector_variant);
  console.log("Step timeout ms:", aggregatedPayload.step_timeout_ms);
  console.log("Run process timeout ms:", runProcessTimeoutMs);
  console.log("Modifier policy:", aggregatedPayload.modifier_policy);
  console.log("Combat DQN checkpoint:", aggregatedPayload.combat_dqn_checkpoint);
  console.log("Average wave reached:", aggregatedPayload.summary?.average_wave_reached ?? "unknown");
  console.log("Average total reward:", aggregatedPayload.summary?.average_total_reward ?? "unknown");
} finally {
  cleanup();
}
