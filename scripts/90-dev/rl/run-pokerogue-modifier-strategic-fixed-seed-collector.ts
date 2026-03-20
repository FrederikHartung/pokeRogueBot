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
  : "python3";
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
    average_wave_reached: number;
    average_total_reward: number;
    best_wave_reached: number;
    worst_wave_reached: number;
  };
  episodes: EpisodeSummary[];
};

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

function runSingleCollectorBatch(runIndex: number): CollectorPayload {
  const runTempRelativeDir = path.join("test", ".external-rl", runId, `run-${runIndex}`);
  const runTempDir = path.join(pokerogueRoot, runTempRelativeDir);
  const runTempTestRelativePath = path.join(runTempRelativeDir, "modifier-strategic-fixed-seed-collector.test.ts");
  const runTempTestPath = path.join(pokerogueRoot, runTempTestRelativePath);
  const runOutputPath = path.join(tempDir, `run-${runIndex}.json`);

  mkdirSync(runTempDir, { recursive: true });
  writeFileSync(runTempTestPath, buildTestSource(runOutputPath, runIndexBase + runIndex), { encoding: "utf8" });

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

  if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT") {
    throw new Error(`collector_run_process_timeout:${runIndex}:${runProcessTimeoutMs}`);
  }

  if (!existsSync(runOutputPath)) {
    throw new Error(`collector_run_missing_output:${runIndex}`);
  }

  if (result.status !== 0) {
    throw new Error(`collector_run_failed:${runIndex}:exit_${result.status ?? 1}`);
  }

  const payload = JSON.parse(readFileSync(runOutputPath, "utf8")) as CollectorPayload;
  if (!Array.isArray(payload.episodes) || payload.episodes.length !== 1) {
    throw new Error(`collector_run_invalid_episode_count:${runIndex}:${payload.episodes?.length ?? "unknown"}`);
  }
  const episode = payload.episodes[0];
  if (isTechnicalTerminationReason(episode?.termination_reason)) {
    throw new Error(`collector_run_technical_termination:${runIndex}:${episode?.termination_reason ?? "unknown"}`);
  }
  console.log(
    `[modifier-strategic-fixed-seed-runner] finished run ${runIndex + 1}/${runCount} wave=${episode?.wave_reached ?? "unknown"} reward=${episode?.total_reward ?? "unknown"} termination=${episode?.termination_reason ?? "unknown"}`,
  );
  return payload;
}

try {
  const runPayloads: CollectorPayload[] = [];

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    runPayloads.push(runSingleCollectorBatch(runIndex));
  }

  const firstPayload = runPayloads[0];
  if (!firstPayload) {
    throw new Error("collector_produced_no_payloads");
  }

  const episodes = runPayloads.flatMap(payload => payload.episodes);
  const averageWaveReached = episodes.reduce((sum, episode) => sum + episode.wave_reached, 0) / episodes.length;
  const averageTotalReward = episodes.reduce((sum, episode) => sum + episode.total_reward, 0) / episodes.length;

  const aggregatedPayload: CollectorPayload = {
    schema_version: firstPayload.schema_version,
    seed: firstPayload.seed,
    run_count: runCount,
    max_waves: firstPayload.max_waves,
    collector_variant: firstPayload.collector_variant,
    worker_id: firstPayload.worker_id,
    starter_config_id: firstPayload.starter_config_id,
    starter_species: firstPayload.starter_species,
    decision_rng_strategy: firstPayload.decision_rng_strategy,
    step_timeout_ms: firstPayload.step_timeout_ms,
    modifier_policy: firstPayload.modifier_policy,
    combat_dqn_checkpoint: firstPayload.combat_dqn_checkpoint,
    combat_dqn_device: firstPayload.combat_dqn_device,
    generated_at: new Date().toISOString(),
    summary: {
      average_wave_reached: averageWaveReached,
      average_total_reward: averageTotalReward,
      best_wave_reached: Math.max(...episodes.map(episode => episode.wave_reached)),
      worst_wave_reached: Math.min(...episodes.map(episode => episode.wave_reached)),
    },
    episodes,
  };

  writeFileSync(outputPath, JSON.stringify(aggregatedPayload, null, 2), { encoding: "utf8" });

  console.log("Modifier strategic fixed-seed collector output:", outputPath);
  console.log("Seed:", aggregatedPayload.seed);
  console.log("Runs:", aggregatedPayload.run_count);
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
