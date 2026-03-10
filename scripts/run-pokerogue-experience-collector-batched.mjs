import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const defaultConfigPath = path.join(repoRoot, "data", "rl", "collector-run.json");

const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;
const batchEpisodesPerSeedArg = process.argv[3] ? Number.parseInt(process.argv[3], 10) : Number.NaN;
const envBatchEpisodesPerSeed = Number.parseInt(process.env.COLLECTOR_BATCH_EPISODES_PER_SEED ?? "", 10);

if (!Number.isInteger(batchEpisodesPerSeedArg) && !Number.isInteger(envBatchEpisodesPerSeed)) {
  throw new Error("Missing batch size. Pass batch episodes per seed as argv[3] or COLLECTOR_BATCH_EPISODES_PER_SEED.");
}

const batchEpisodesPerSeed = Number.isInteger(batchEpisodesPerSeedArg)
  ? batchEpisodesPerSeedArg
  : envBatchEpisodesPerSeed;

if (!Number.isInteger(batchEpisodesPerSeed) || batchEpisodesPerSeed <= 0) {
  throw new Error(`Invalid batch episodes per seed: ${batchEpisodesPerSeed}`);
}

const baseConfig = absolutizeCollectorPaths(JSON.parse(readFileSync(configPath, "utf8")), configPath);
const totalEpisodesPerSeed = Number.isInteger(baseConfig.episodes_per_seed) ? baseConfig.episodes_per_seed : 1;
const batchCount = Math.ceil(totalEpisodesPerSeed / batchEpisodesPerSeed);
const runStartedAt = Date.now();

if (batchCount <= 1) {
  console.log(`[collector-batch] single batch only, delegating directly episodes_per_seed=${totalEpisodesPerSeed}`);
  const result = spawnSync("node", ["scripts/run-pokerogue-experience-collector.mjs", configPath], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

const tempDir = mkdtempSync(path.join(os.tmpdir(), "collector-batches-"));
const scenarioCount = Array.isArray(baseConfig.scenario_files) ? baseConfig.scenario_files.length : 0;
const seedCount = Array.isArray(baseConfig.seeds) && baseConfig.seeds.length > 0 ? baseConfig.seeds.length : 1;

console.log(
  `[collector-batch] starting config=${configPath} episodes_per_seed=${totalEpisodesPerSeed} ` +
  `batch_episodes_per_seed=${batchEpisodesPerSeed} batches=${batchCount} ` +
  `planned_total_episodes=${totalEpisodesPerSeed * Math.max(1, scenarioCount) * seedCount}`,
);

let remainingEpisodesPerSeed = totalEpisodesPerSeed;

try {
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const currentEpisodesPerSeed = Math.min(batchEpisodesPerSeed, remainingEpisodesPerSeed);
    const batchConfig = {
      ...baseConfig,
      episodes_per_seed: currentEpisodesPerSeed,
      append_output: batchIndex > 0,
      quiet_game_logs: baseConfig.quiet_game_logs !== false,
    };

    const batchConfigPath = path.join(tempDir, `collector-batch-${String(batchIndex + 1).padStart(3, "0")}.json`);
    writeFileSync(batchConfigPath, `${JSON.stringify(batchConfig, null, 2)}\n`, "utf8");

    console.log(
      `[collector-batch] batch=${batchIndex + 1}/${batchCount} ` +
      `episodes_per_seed=${currentEpisodesPerSeed} append_output=${batchIndex > 0}`,
    );

    const startedAt = Date.now();
    const result = spawnSync("node", ["scripts/run-pokerogue-experience-collector.mjs", batchConfigPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    const runtimeMs = Date.now() - startedAt;

    if (result.status !== 0) {
      console.log(
        `[collector-batch] failed batch=${batchIndex + 1}/${batchCount} status=${result.status ?? "unknown"} runtime_ms=${runtimeMs}`,
      );
      process.exit(result.status ?? 1);
    }

    console.log(
      `[collector-batch] completed batch=${batchIndex + 1}/${batchCount} runtime_ms=${runtimeMs} remaining_batches=${batchCount - batchIndex - 1}`,
    );

    remainingEpisodesPerSeed -= currentEpisodesPerSeed;
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const totalRuntimeMs = Date.now() - runStartedAt;
console.log(`[collector-batch] all batches completed total_runtime_ms=${totalRuntimeMs} total_runtime=${formatDuration(totalRuntimeMs)}`);

function absolutizeCollectorPaths(config, sourceConfigPath) {
  const configDir = path.dirname(sourceConfigPath);
  const normalized = { ...config };

  if (Array.isArray(normalized.scenario_files)) {
    normalized.scenario_files = normalized.scenario_files
      .filter(entry => typeof entry === "string")
      .map(entry => (path.isAbsolute(entry) ? entry : path.resolve(configDir, entry)));
  }

  if (typeof normalized.scenario_dir === "string") {
    normalized.scenario_dir = path.isAbsolute(normalized.scenario_dir)
      ? normalized.scenario_dir
      : path.resolve(configDir, normalized.scenario_dir);
  }

  if (typeof normalized.output_path === "string") {
    normalized.output_path = path.isAbsolute(normalized.output_path)
      ? normalized.output_path
      : path.resolve(configDir, normalized.output_path);
  }

  return normalized;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
