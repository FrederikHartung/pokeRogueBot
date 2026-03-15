import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validatePolicyConfig } from "../rl-config/policy-contract.ts";
import { validateRandomCollectionPipelineConfig } from "../rl-config/run-config-contract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "wave-library-random-collection-remote-50ep.json");
const cli = parseCli(process.argv.slice(2));
const configPath = path.resolve(cli.configPath ?? defaultConfigPath);

if (!existsSync(configPath)) {
  throw new Error(`Collection config not found: ${configPath}`);
}

const config = validateRandomCollectionPipelineConfig(JSON.parse(readFileSync(configPath, "utf8")), {
  context: configPath,
});
const configDir = path.dirname(configPath);
const dataRlDir = path.join(repoRoot, "data", "rl");
const pipelineRoot = resolvePathWithFallbacks(
  config.output_root ?? "./pipeline-runs/wave-library-random-collection",
  [configDir, dataRlDir, repoRoot],
);
const manifestPath = resolvePathWithFallbacks(
  config.manifest_path ?? path.join(pipelineRoot, "manifest.json"),
  [configDir, dataRlDir, repoRoot],
);
const artifactsSummaryPath = path.join(pipelineRoot, "artifacts-summary.json");
const metricsPath = path.join(pipelineRoot, "collection-metrics.json");
const phases = ["collect_dataset", "merge_dataset", "sanity_check", "archive_dataset"];

mkdirSync(pipelineRoot, { recursive: true });

const scenarios = resolveScenarios(config, configDir, dataRlDir);
if (scenarios.length === 0) {
  throw new Error(`No scenarios resolved for collection config: ${configPath}`);
}

let manifest = loadManifest(manifestPath, configPath);
manifest = syncManifest(manifest, config, scenarios, pipelineRoot);
saveManifest(manifestPath, manifest);
writeArtifactsSummary(manifest);

if (cli.prepareOnly) {
  console.log(`Prepared manifest: ${manifestPath}`);
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Batches: ${manifest.batches.length}`);
  process.exit(0);
}

await main();

async function main() {
  for (const phaseName of phases) {
    manifest = loadManifest(manifestPath, configPath);
    if (manifest.steps?.[phaseName]?.status === "completed") {
      console.log(`Skipping completed phase: ${phaseName}`);
      if (cli.stopAfterPhase === phaseName) {
        break;
      }
      continue;
    }

    manifest = markStepStatus(manifest, phaseName, "running");
    saveManifest(manifestPath, manifest);

    try {
      if (phaseName === "collect_dataset") {
        manifest = await runCollectPhase(manifest, config, configDir, dataRlDir);
      } else if (phaseName === "merge_dataset") {
        manifest = await mergeCollectedBatches(manifest);
      } else if (phaseName === "sanity_check") {
        manifest = runSanityCheck(manifest);
      } else if (phaseName === "archive_dataset") {
        manifest = runArchivePhase(manifest, config, configDir);
      } else {
        throw new Error(`Unsupported phase: ${phaseName}`);
      }

      manifest = markStepStatus(manifest, phaseName, "completed");
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
    } catch (error) {
      manifest = markStepStatus(manifest, phaseName, "failed", String(error?.message ?? error));
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
      manifest = writeCollectionMetrics(manifest);
      await notifyIfConfigured({
        event: "collection_failed",
        phase: phaseName,
        error: String(error?.message ?? error),
      });
      throw error;
    }

    if (cli.stopAfterPhase === phaseName) {
      break;
    }
  }

  manifest = loadManifest(manifestPath, configPath);
  manifest = writeCollectionMetrics(manifest);
  writeArtifactsSummary(manifest);

  if (cli.stopAfterPhase == null && phases.every(phase => manifest.steps?.[phase]?.status === "completed")) {
    await notifyIfConfigured({
      event: "collection_completed",
      phase: "completed",
    });
  }
}

function parseCli(args) {
  const state = {
    configPath: null,
    prepareOnly: false,
    stopAfterPhase: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--prepare-only") {
      state.prepareOnly = true;
      continue;
    }
    if (arg === "--stop-after-phase") {
      state.stopAfterPhase = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (!arg.startsWith("--") && state.configPath == null) {
      state.configPath = arg;
    }
  }

  return state;
}

function resolveScenarios(rootConfig, baseDir, localDataRlDir) {
  const includeWaves = toNumberSet(rootConfig.include_waves);
  const excludeWaves = toNumberSet(rootConfig.exclude_waves);
  const resolved = [];

  for (const dirEntry of rootConfig.scenario_dirs ?? []) {
    const resolvedDir = resolvePathWithFallbacks(dirEntry, [baseDir, localDataRlDir, repoRoot]);
    if (!existsSync(resolvedDir)) {
      continue;
    }
    for (const name of readdirSync(resolvedDir).filter(name => name.endsWith(".json")).sort()) {
      resolved.push(path.join(resolvedDir, name));
    }
  }

  for (const fileEntry of rootConfig.scenario_files ?? []) {
    const fullPath = resolvePathWithFallbacks(fileEntry, [baseDir, localDataRlDir, repoRoot]);
    if (existsSync(fullPath)) {
      resolved.push(fullPath);
    }
  }

  return Array.from(new Set(resolved))
    .map(filePath => {
      const raw = JSON.parse(readFileSync(filePath, "utf8"));
      return {
        path: filePath,
        scenario_name: path.basename(filePath, ".json"),
        wave_index: Number(raw.wave_index),
        battle_type: String(raw.battle_type ?? "UNKNOWN"),
      };
    })
    .filter(scenario => Number.isInteger(scenario.wave_index))
    .filter(scenario => includeWaves.size === 0 || includeWaves.has(scenario.wave_index))
    .filter(scenario => !excludeWaves.has(scenario.wave_index))
    .sort((left, right) => {
      const waveDelta = left.wave_index - right.wave_index;
      if (waveDelta !== 0) {
        return waveDelta;
      }
      return left.scenario_name.localeCompare(right.scenario_name);
    });
}

function loadManifest(filePath, activeConfigPath) {
  if (!existsSync(filePath)) {
    return {
      schema_version: 1,
      run_kind: "wave_library_random_collection",
      config_path: activeConfigPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      batches: [],
      steps: {},
      outputs: {},
    };
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function syncManifest(currentManifest, rootConfig, scenariosInput, outputRoot) {
  const manifest = {
    ...currentManifest,
    updated_at: new Date().toISOString(),
    outputs: currentManifest.outputs ?? {},
    steps: currentManifest.steps ?? {},
  };

  const plannedBatches = buildBatches(rootConfig, scenariosInput, outputRoot);
  const existingById = new Map((manifest.batches ?? []).map(batch => [batch.id, batch]));
  manifest.batches = plannedBatches.map(batch => {
    const existing = existingById.get(batch.id);
    return existing == null
      ? batch
      : {
          ...batch,
          status: existing.status ?? "pending",
          started_at: existing.started_at ?? null,
          completed_at: existing.completed_at ?? null,
          duration_ms: existing.duration_ms ?? null,
          error: existing.error ?? null,
        };
  });

  return manifest;
}

function buildBatches(rootConfig, scenariosInput, outputRoot) {
  const collectConfig = rootConfig.collect ?? {};
  const episodesPerInstance = Number(collectConfig.episodes_per_instance ?? 0);
  const batchSize = Number(collectConfig.batch_size ?? 0);
  if (!Number.isInteger(episodesPerInstance) || episodesPerInstance <= 0) {
    throw new Error("Invalid collect.episodes_per_instance");
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Invalid collect.batch_size");
  }

  const batches = [];
  let globalEpisodeCursor = 0;

  for (const scenario of scenariosInput) {
    const batchCount = Math.ceil(episodesPerInstance / batchSize);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const remaining = episodesPerInstance - (batchIndex * batchSize);
      const episodes = Math.min(batchSize, remaining);
      const phaseDir = path.join(outputRoot, "collect_dataset");
      const batchesDir = path.join(phaseDir, "batches");
      const configsDir = path.join(phaseDir, "configs");
      mkdirSync(batchesDir, { recursive: true });
      mkdirSync(configsDir, { recursive: true });
      const batchNumber = String(batchIndex + 1).padStart(4, "0");
      const batchId = `collect_dataset::${scenario.scenario_name}::${batchNumber}`;

      batches.push({
        id: batchId,
        phase: "collect_dataset",
        wave_index: scenario.wave_index,
        scenario_name: scenario.scenario_name,
        scenario_path: scenario.path,
        batch_index: batchIndex,
        episodes,
        global_episode_start: globalEpisodeCursor,
        output_path: path.join(batchesDir, `${scenario.scenario_name}--batch-${batchNumber}.jsonl`),
        run_config_path: path.join(configsDir, `${scenario.scenario_name}--batch-${batchNumber}.json`),
        status: "pending",
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error: null,
      });
      globalEpisodeCursor += episodes;
    }
  }

  return batches;
}

async function runCollectPhase(currentManifest, rootConfig, configDirInput, localDataRlDir) {
  const manifestInput = structuredClone(currentManifest);
  const pendingBatches = manifestInput.batches.filter(batch => batch.phase === "collect_dataset" && batch.status !== "completed");
  const collectConfig = rootConfig.collect ?? {};
  const parallelism = Math.max(1, Number(collectConfig.parallelism ?? rootConfig.parallelism ?? 1));

  await runWithConcurrency(pendingBatches, parallelism, async batch => {
    const batchRef = manifestInput.batches.find(entry => entry.id === batch.id);
    batchRef.status = "running";
    batchRef.started_at = new Date().toISOString();
    batchRef.error = null;
    saveManifest(manifestPath, manifestInput);

    const collectorConfig = buildCollectorConfig({
      rootConfig,
      configDir: configDirInput,
      dataRlDir: localDataRlDir,
      batch,
    });
    writeFileSync(batch.run_config_path, `${JSON.stringify(collectorConfig, null, 2)}\n`, "utf8");

    const startedAt = Date.now();
    try {
      await runCommandAsync("node", ["scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts", batch.run_config_path], repoRoot);
      batchRef.status = "completed";
      batchRef.completed_at = new Date().toISOString();
      batchRef.duration_ms = Date.now() - startedAt;
      batchRef.error = null;
    } catch (error) {
      batchRef.status = "failed";
      batchRef.completed_at = new Date().toISOString();
      batchRef.duration_ms = Date.now() - startedAt;
      batchRef.error = String(error?.message ?? error);
      saveManifest(manifestPath, manifestInput);
      throw error;
    }

    saveManifest(manifestPath, manifestInput);
  });

  return manifestInput;
}

function buildCollectorConfig({ rootConfig, configDir: configDirInput, dataRlDir: localDataRlDir, batch }) {
  const collectConfig = rootConfig.collect ?? {};
  const collectorTemplate = {
    ...(rootConfig.collector_defaults ?? {}),
    ...(collectConfig.collector ?? {}),
  };
  const collectorConfig = {
    ...collectorTemplate,
    scenario_files: [batch.scenario_path],
    output_path: batch.output_path,
    append_output: false,
    episodes_per_seed: batch.episodes,
    episode_index_offset: batch.global_episode_start,
    policy: resolveCollectionPolicy(collectConfig.policy),
  };

  if (collectorConfig.test_timeout_ms == null) {
    collectorConfig.test_timeout_ms = 600000;
  }

  normalizeConfigPaths(collectorConfig, configDirInput, localDataRlDir);
  return collectorConfig;
}

function resolveCollectionPolicy(policyConfig) {
  return validatePolicyConfig(policyConfig ?? { type: "random" }, {
    context: "wave_library_random_collection.collect.policy",
    allowTypes: ["random"],
  });
}

function normalizeConfigPaths(collectorConfig, configDirInput, localDataRlDir) {
  for (const key of ["player_team_overrides_path", "enemy_team_overrides_path"]) {
    if (typeof collectorConfig[key] === "string" && collectorConfig[key].length > 0) {
      collectorConfig[key] = resolvePathWithFallbacks(collectorConfig[key], [configDirInput, localDataRlDir, repoRoot]);
    }
  }
}

async function mergeCollectedBatches(currentManifest) {
  const manifestInput = structuredClone(currentManifest);
  const mergedDir = path.join(pipelineRoot, "merged");
  mkdirSync(mergedDir, { recursive: true });
  const datasetPath = path.join(mergedDir, "random-valid-action-w1-8.jsonl");
  const writer = createWriteStream(datasetPath, { encoding: "utf8" });

  let rowCount = 0;
  for (const batch of manifestInput.batches
    .filter(entry => entry.phase === "collect_dataset" && entry.status === "completed")
    .sort((left, right) => left.id.localeCompare(right.id))) {
    if (!existsSync(batch.output_path)) {
      continue;
    }
    const reader = readline.createInterface({
      input: createReadStream(batch.output_path, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
    for await (const line of reader) {
      if (!line) {
        continue;
      }
      writer.write(`${line}\n`);
      rowCount += 1;
    }
  }

  await new Promise((resolve, reject) => {
    writer.on("error", reject);
    writer.end(resolve);
  });

  const datasetSizeBytes = statSync(datasetPath).size;
  manifestInput.outputs.collect_dataset = {
    dataset_path: datasetPath,
    rows: rowCount,
    size_bytes: datasetSizeBytes,
  };
  return manifestInput;
}

function runSanityCheck(currentManifest) {
  const manifestInput = structuredClone(currentManifest);
  const datasetPath = manifestInput.outputs?.collect_dataset?.dataset_path;
  if (!datasetPath || !existsSync(datasetPath)) {
    throw new Error("Merged dataset missing for sanity_check");
  }
  runCommand("node", ["scripts/01-data-generation/dataset/run-rl-dataset-sanity.mjs", datasetPath], repoRoot);
  manifestInput.outputs.sanity_check = {
    dataset_path: datasetPath,
    checked_at: new Date().toISOString(),
  };
  return manifestInput;
}

function runArchivePhase(currentManifest, rootConfig, configDirInput) {
  const manifestInput = structuredClone(currentManifest);
  const datasetPath = manifestInput.outputs?.collect_dataset?.dataset_path;
  if (!datasetPath || !existsSync(datasetPath)) {
    throw new Error("Merged dataset missing for archive_dataset");
  }

  const archiveConfig = rootConfig.archive ?? {};
  const archiveFormat = String(archiveConfig.format ?? "tar.gz");
  const archiveDir = path.join(pipelineRoot, "artifacts");
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = resolveArchivePath(archiveConfig, archiveFormat, archiveDir, configDirInput);

  if (archiveFormat === "tar.gz") {
    runCommand("tar", ["-czf", archivePath, "-C", path.dirname(datasetPath), path.basename(datasetPath)], repoRoot);
  } else if (archiveFormat === "zip") {
    runCommand("zip", ["-j", archivePath, datasetPath], repoRoot);
  } else {
    throw new Error(`Unsupported archive format: ${archiveFormat}`);
  }

  manifestInput.outputs.archive_dataset = {
    archive_path: archivePath,
    archive_format: archiveFormat,
    size_bytes: statSync(archivePath).size,
    download_path: archivePath,
  };
  return manifestInput;
}

function resolveArchivePath(archiveConfig, archiveFormat, archiveDir, configDirInput) {
  if (typeof archiveConfig.output_path === "string" && archiveConfig.output_path.length > 0) {
    return resolvePathWithFallbacks(archiveConfig.output_path, [configDirInput, dataRlDir, repoRoot]);
  }
  const suffix = archiveFormat === "zip" ? ".zip" : ".tar.gz";
  return path.join(archiveDir, `random-valid-action-w1-8${suffix}`);
}

function writeCollectionMetrics(currentManifest) {
  const manifestInput = structuredClone(currentManifest);
  const metrics = buildCollectionMetrics(manifestInput);
  writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  manifestInput.outputs.collection_metrics = {
    metrics_path: metricsPath,
    download_path: metrics.download_path,
  };
  saveManifest(manifestPath, manifestInput);
  return manifestInput;
}

function buildCollectionMetrics(manifestInput) {
  const batches = Array.isArray(manifestInput.batches) ? manifestInput.batches : [];
  const outputs = manifestInput.outputs ?? {};
  const datasetOutput = outputs.collect_dataset ?? {};
  const archiveOutput = outputs.archive_dataset ?? {};
  const completedBatches = batches.filter(batch => batch.status === "completed");
  const batchDurations = completedBatches
    .map(batch => batch.duration_ms)
    .filter(value => typeof value === "number" && Number.isFinite(value));
  const totalRuntimeMs = Object.values(manifestInput.steps ?? {})
    .map(step => step?.duration_ms)
    .filter(value => typeof value === "number" && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);

  const collectConfig = config.collect ?? {};
  return {
    schema_version: 1,
    run_kind: "wave_library_random_collection",
    run_name: path.basename(pipelineRoot),
    config_path: configPath,
    runtime_dir: pipelineRoot,
    manifest_path: manifestPath,
    dataset_path: datasetOutput.dataset_path ?? null,
    dataset_rows: datasetOutput.rows ?? null,
    dataset_size_bytes: datasetOutput.size_bytes ?? null,
    dataset_size_mb: toMegabytes(datasetOutput.size_bytes),
    archive_path: archiveOutput.archive_path ?? null,
    archive_format: archiveOutput.archive_format ?? null,
    archive_size_bytes: archiveOutput.size_bytes ?? null,
    archive_size_mb: toMegabytes(archiveOutput.size_bytes),
    download_path: archiveOutput.download_path ?? archiveOutput.archive_path ?? datasetOutput.dataset_path ?? null,
    local_import_dir: process.env.POKEROGUE_COLLECTION_LOCAL_IMPORT_DIR ?? "/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/rl/combat/",
    scp_download_command: buildScpDownloadCommand(
      archiveOutput.download_path ?? archiveOutput.archive_path ?? datasetOutput.dataset_path ?? null,
    ),
    scenario_count: new Set(batches.map(batch => batch.scenario_name)).size,
    waves: sortedUnique(batches.map(batch => batch.wave_index).filter(Number.isInteger)),
    episodes_per_instance: Number.isInteger(collectConfig.episodes_per_instance) ? collectConfig.episodes_per_instance : null,
    batch_size: Number.isInteger(collectConfig.batch_size) ? collectConfig.batch_size : null,
    total_batches: batches.length,
    completed_batches: completedBatches.length,
    failed_batches: batches.filter(batch => batch.status === "failed").length,
    total_episodes: batches.reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0),
    completed_episodes: completedBatches.reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0),
    average_batch_duration_ms: batchDurations.length > 0
      ? Math.round(batchDurations.reduce((sum, value) => sum + value, 0) / batchDurations.length)
      : null,
    total_runtime_ms: totalRuntimeMs > 0 ? totalRuntimeMs : null,
    started_at: manifestInput.created_at ?? null,
    updated_at: manifestInput.updated_at ?? null,
    completed_at: phases.every(phase => manifestInput.steps?.[phase]?.status === "completed")
      ? manifestInput.updated_at ?? null
      : null,
    steps: manifestInput.steps ?? {},
  };
}

function writeArtifactsSummary(manifestInput) {
  const summary = {
    manifest_path: manifestPath,
    updated_at: new Date().toISOString(),
    outputs: manifestInput.outputs ?? {},
    steps: manifestInput.steps ?? {},
    recommended_downloads: {
      dataset: manifestInput.outputs?.collect_dataset?.dataset_path ?? null,
      dataset_archive: manifestInput.outputs?.archive_dataset?.archive_path ?? null,
      collection_metrics: manifestInput.outputs?.collection_metrics?.metrics_path ?? metricsPath,
    },
  };
  writeFileSync(artifactsSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function notifyIfConfigured({ event, phase, error = null }) {
  const args = [
    "scripts/04-automation/telegram/send-pipeline-notification.mjs",
    "--event",
    event,
    "--manifest",
    manifestPath,
    "--runtime-dir",
    pipelineRoot,
    "--phase",
    phase,
    "--collection-metrics",
    metricsPath,
  ];
  if (error) {
    args.push("--error", error);
  }
  runCommand("node", args, repoRoot);
}

function markStepStatus(currentManifest, stepName, status, errorText = null) {
  const manifestInput = structuredClone(currentManifest);
  const now = new Date().toISOString();
  const existing = manifestInput.steps?.[stepName] ?? {};
  const startedAt = status === "running" ? now : (existing.started_at ?? now);
  const durationMs = status === "completed" || status === "failed"
    ? computeDurationMs(startedAt, now)
    : existing.duration_ms ?? null;

  manifestInput.steps = manifestInput.steps ?? {};
  manifestInput.steps[stepName] = {
    status,
    started_at: startedAt,
    completed_at: status === "completed" || status === "failed" ? now : null,
    duration_ms: durationMs,
    error: errorText,
  };
  return manifestInput;
}

function computeDurationMs(startedAt, completedAt) {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    return null;
  }
  return Math.max(0, completed - started);
}

function saveManifest(filePath, manifestInput) {
  const nextManifest = {
    ...manifestInput,
    updated_at: new Date().toISOString(),
  };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
}

function resolvePathWithFallbacks(pathValue, bases) {
  if (path.isAbsolute(pathValue)) {
    return pathValue;
  }
  for (const base of bases) {
    const candidate = path.resolve(base, pathValue);
    if (existsSync(candidate) || existsSync(path.dirname(candidate))) {
      return candidate;
    }
  }
  return path.resolve(bases[0], pathValue);
}

function toNumberSet(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }
  return new Set(values.filter(Number.isInteger));
}

function toMegabytes(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number((value / 1024 / 1024).toFixed(2))
    : null;
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function buildScpDownloadCommand(downloadPath) {
  if (typeof downloadPath !== "string" || downloadPath.length === 0) {
    return null;
  }

  const sshTarget = process.env.POKEROGUE_REMOTE_SSH_TARGET ?? "SFH-Frederik@152.53.176.72";
  const sshKeyPath = process.env.POKEROGUE_REMOTE_SSH_KEY ?? "/Users/frederikhartung/.ssh/id_rsa_github_privat";
  const localImportDir = process.env.POKEROGUE_COLLECTION_LOCAL_IMPORT_DIR ?? "/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/rl/combat/";
  return `scp -i ${shellQuote(sshKeyPath)} ${shellQuote(`${sshTarget}:${downloadPath}`)} ${shellQuote(localImportDir)}`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed (${command} ${args.join(" ")}) with exit code ${result.status ?? 1}`);
  }
}

function runCommandAsync(command, args, cwd, stdio = "inherit") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio,
    });
    child.on("error", reject);
    child.on("exit", code => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`Command failed (${command} ${args.join(" ")}) with exit code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function runWithConcurrency(items, concurrency, worker) {
  const queue = items.slice();
  const active = [];

  while (queue.length > 0 || active.length > 0) {
    while (queue.length > 0 && active.length < concurrency) {
      const item = queue.shift();
      const promise = Promise.resolve(worker(item))
        .finally(() => {
          const index = active.indexOf(promise);
          if (index >= 0) {
            active.splice(index, 1);
          }
        });
      active.push(promise);
    }

    if (active.length > 0) {
      await Promise.race(active);
    }
  }
}
