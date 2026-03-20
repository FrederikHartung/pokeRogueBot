import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validateModifierStrategicPipelineConfig } from "../rl-config/run-config-contract.ts";
import { buildModifierStrategicTrainingTransitions } from "../../90-dev/rl/build-modifier-strategic-training-transitions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "modifier-strategic-seeded-remote-10seeds-20runs-wave30.json");
const cli = parseCli(process.argv.slice(2));
const configPath = path.resolve(cli.configPath ?? defaultConfigPath);

if (!existsSync(configPath)) {
  throw new Error(`Modifier strategic pipeline config not found: ${configPath}`);
}

const config = validateModifierStrategicPipelineConfig(JSON.parse(readFileSync(configPath, "utf8")), {
  context: configPath,
});
const configDir = path.dirname(configPath);
const dataRlDir = path.join(repoRoot, "data", "rl");
const pipelineRoot = resolvePathWithFallbacks(
  config.output_root ?? "./pipeline-runs/modifier-strategic-seeded-remote",
  [configDir, dataRlDir, repoRoot],
);
const manifestPath = resolvePathWithFallbacks(
  config.manifest_path ?? path.join(pipelineRoot, "manifest.json"),
  [configDir, dataRlDir, repoRoot],
);
const artifactsSummaryPath = path.join(pipelineRoot, "artifacts-summary.json");
const metricsPath = path.join(pipelineRoot, "collection-metrics.json");
const phases = ["collect_dataset", "build_transitions", "archive_dataset"];

mkdirSync(pipelineRoot, { recursive: true });

const seeds = resolveSeeds(config);
if (seeds.length === 0) {
  throw new Error(`No seeds resolved for config: ${configPath}`);
}

let manifest = loadManifest(manifestPath, configPath);
manifest = syncManifest(manifest, config, seeds, pipelineRoot);
saveManifest(manifestPath, manifest);
writeArtifactsSummary(manifest);

if (cli.prepareOnly) {
  console.log(`Prepared manifest: ${manifestPath}`);
  console.log(`Seeds: ${seeds.length}`);
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
        manifest = await runCollectPhase(manifest);
      } else if (phaseName === "build_transitions") {
        manifest = runBuildTransitionsPhase(manifest);
      } else if (phaseName === "archive_dataset") {
        manifest = runArchivePhase(manifest);
      } else {
        throw new Error(`Unsupported phase: ${phaseName}`);
      }

      manifest = markStepStatus(manifest, phaseName, "completed");
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
      manifest = writeCollectionMetrics(manifest);
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
    } catch (error) {
      manifest = markStepStatus(manifest, phaseName, "failed", String(error?.message ?? error));
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
      manifest = writeCollectionMetrics(manifest);
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
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
  saveManifest(manifestPath, manifest);
  writeArtifactsSummary(manifest);

  if (cli.stopAfterPhase == null && phases.every(phase => manifest.steps?.[phase]?.status === "completed")) {
    await notifyIfConfigured({
      event: "collection_completed",
      phase: "completed",
    });
  }
}

function parseCli(args: string[]) {
  const state = {
    configPath: null as string | null,
    prepareOnly: false,
    stopAfterPhase: null as string | null,
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

function resolveSeeds(rootConfig: Record<string, unknown>): string[] {
  if (Array.isArray(rootConfig.seeds) && rootConfig.seeds.length > 0) {
    return Array.from(new Set(rootConfig.seeds.map(seed => String(seed).trim()).filter(seed => seed.length > 0)));
  }

  const prefix = String(rootConfig.seed_prefix ?? "");
  const startIndex = Number(rootConfig.seed_start_index ?? 1);
  const seedCount = Number(rootConfig.seed_count ?? 0);
  const seedsResolved: string[] = [];
  for (let index = 0; index < seedCount; index += 1) {
    seedsResolved.push(`${prefix}${startIndex + index}`);
  }
  return seedsResolved;
}

type Batch = {
  id: string;
  phase: string;
  seed: string;
  run_index_start: number;
  runs: number;
  max_waves: number;
  output_path: string;
  run_config_path: string;
  status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  error?: string | null;
};

function loadManifest(filePath: string, activeConfigPath: string) {
  if (!existsSync(filePath)) {
    return {
      schema_version: 1,
      run_kind: "modifier_strategic_seeded_collection",
      config_path: activeConfigPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      seeds,
      batches: [] as Batch[],
      steps: {} as Record<string, unknown>,
      outputs: {} as Record<string, unknown>,
    };
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function syncManifest(currentManifest: Record<string, unknown>, rootConfig: Record<string, unknown>, seedList: string[], outputRoot: string) {
  const manifestInput = {
    ...currentManifest,
    updated_at: new Date().toISOString(),
    outputs: currentManifest.outputs ?? {},
    steps: currentManifest.steps ?? {},
    seeds: seedList,
  } as Record<string, unknown> & { batches: Batch[] };

  const plannedBatches = buildBatches(rootConfig, seedList, outputRoot);
  const existingById = new Map((manifestInput.batches ?? []).map(batch => [batch.id, batch]));
  manifestInput.batches = plannedBatches.map(batch => {
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

  return manifestInput;
}

function buildBatches(rootConfig: Record<string, unknown>, seedList: string[], outputRoot: string): Batch[] {
  const collectConfig = (rootConfig.collect ?? {}) as Record<string, unknown>;
  const runsPerSeed = Number(collectConfig.runs_per_seed ?? 0);
  const runsPerInstance = Number(collectConfig.runs_per_instance ?? runsPerSeed);
  const maxWaves = Number(collectConfig.max_waves ?? 0);

  if (!Number.isInteger(runsPerSeed) || runsPerSeed <= 0) {
    throw new Error("Invalid collect.runs_per_seed");
  }
  if (!Number.isInteger(runsPerInstance) || runsPerInstance <= 0) {
    throw new Error("Invalid collect.runs_per_instance");
  }
  if (!Number.isInteger(maxWaves) || maxWaves <= 0) {
    throw new Error("Invalid collect.max_waves");
  }

  const batchesDir = path.join(outputRoot, "collect_dataset", "batches");
  const configsDir = path.join(outputRoot, "collect_dataset", "configs");
  mkdirSync(batchesDir, { recursive: true });
  mkdirSync(configsDir, { recursive: true });

  const batches: Batch[] = [];
  for (const seed of seedList) {
    const totalBatchCount = Math.ceil(runsPerSeed / runsPerInstance);
    for (let batchIndex = 0; batchIndex < totalBatchCount; batchIndex += 1) {
      const runIndexStart = batchIndex * runsPerInstance;
      const runs = Math.min(runsPerInstance, runsPerSeed - runIndexStart);
      const slug = sanitizeSlug(seed);
      const batchId = `${slug}--batch-${String(batchIndex + 1).padStart(3, "0")}`;
      batches.push({
        id: batchId,
        phase: "collect_dataset",
        seed,
        run_index_start: runIndexStart,
        runs,
        max_waves: maxWaves,
        output_path: path.join(batchesDir, `${batchId}.json`),
        run_config_path: path.join(configsDir, `${batchId}.json`),
        status: "pending",
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error: null,
      });
    }
  }

  return batches;
}

function sanitizeSlug(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
}

async function runCollectPhase(currentManifest: Record<string, unknown>) {
  const manifestInput = structuredClone(currentManifest) as Record<string, unknown> & { batches: Batch[] };
  const pendingBatches = manifestInput.batches.filter(batch => batch.phase === "collect_dataset" && batch.status !== "completed");
  const collectConfig = config.collect as Record<string, unknown>;
  const parallelism = Math.max(1, Number(collectConfig.parallelism ?? 1));

  const queue = pendingBatches.slice();
  const running = new Map<string, { batch: Batch; child: ChildProcess; promise: Promise<void> }>();
  let firstError: unknown = null;

  const startBatch = (batch: Batch) => {
    const batchRef = manifestInput.batches.find(entry => entry.id === batch.id);
    if (!batchRef) {
      throw new Error(`Unknown batch: ${batch.id}`);
    }

    batchRef.status = "running";
    batchRef.started_at = new Date().toISOString();
    batchRef.completed_at = null;
    batchRef.duration_ms = null;
    batchRef.error = null;
    saveManifest(manifestPath, manifestInput);

    writeFileSync(batch.run_config_path, `${JSON.stringify(buildBatchRunConfig(batch), null, 2)}\n`, "utf8");

    const startedAt = Date.now();
    const child = spawn("node", buildBatchRunnerArgs(batch), {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });

    const promise = new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", code => {
        if ((code ?? 1) !== 0) {
          reject(new Error(`Command failed (node ${buildBatchRunnerArgs(batch).join(" ")}) with exit code ${code ?? 1}`));
          return;
        }
        resolve();
      });
    })
      .then(() => {
        batchRef.status = "completed";
        batchRef.completed_at = new Date().toISOString();
        batchRef.duration_ms = Date.now() - startedAt;
        batchRef.error = null;
      })
      .catch(error => {
        batchRef.status = "failed";
        batchRef.completed_at = new Date().toISOString();
        batchRef.duration_ms = Date.now() - startedAt;
        batchRef.error = String(error?.message ?? error);
        saveManifest(manifestPath, manifestInput);

        if (firstError == null) {
          firstError = error;
          terminateRunningBatchChildren(running, batch.id);
        }

        throw error;
      })
      .finally(() => {
        running.delete(batch.id);
        saveManifest(manifestPath, manifestInput);
      });

    running.set(batch.id, { batch, child, promise });
  };

  while ((queue.length > 0 || running.size > 0) && firstError == null) {
    while (queue.length > 0 && running.size < parallelism && firstError == null) {
      const nextBatch = queue.shift();
      if (!nextBatch) {
        continue;
      }
      startBatch(nextBatch);
    }

    if (running.size === 0) {
      break;
    }

    try {
      await Promise.race(Array.from(running.values(), entry => entry.promise));
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError != null) {
    await Promise.allSettled(Array.from(running.values(), entry => entry.promise));
    throw firstError;
  }

  return manifestInput;
}

function buildBatchRunConfig(batch: Batch) {
  const collectConfig = config.collect as Record<string, unknown>;
  return {
    batch_id: batch.id,
    seed: batch.seed,
    run_index_start: batch.run_index_start,
    runs: batch.runs,
    max_waves: batch.max_waves,
    modifier_policy: collectConfig.modifier_policy,
    step_timeout_ms: collectConfig.step_timeout_ms ?? null,
    run_process_timeout_ms: collectConfig.run_process_timeout_ms ?? null,
    combat_dqn_checkpoint: collectConfig.combat_dqn_checkpoint ?? null,
    combat_dqn_device: collectConfig.combat_dqn_device ?? null,
    combat_dqn_python: collectConfig.combat_dqn_python ?? null,
    output_path: batch.output_path,
  };
}

function buildBatchRunnerArgs(batch: Batch): string[] {
  const collectConfig = config.collect as Record<string, unknown>;
  return [
    "scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts",
    batch.output_path,
    batch.seed,
    String(batch.runs),
    String(batch.max_waves),
    String(collectConfig.modifier_policy ?? "random_executable"),
    String(collectConfig.combat_dqn_checkpoint ?? ""),
    String(collectConfig.combat_dqn_device ?? ""),
    String(collectConfig.combat_dqn_python ?? ""),
    String(collectConfig.step_timeout_ms ?? ""),
    String(collectConfig.run_process_timeout_ms ?? ""),
    String(batch.run_index_start),
  ];
}

function runBuildTransitionsPhase(currentManifest: Record<string, unknown>) {
  const manifestInput = structuredClone(currentManifest) as Record<string, unknown> & { batches: Batch[]; outputs: Record<string, unknown> };
  const postprocessConfig = config.postprocess as Record<string, unknown>;
  if (postprocessConfig.enabled === false) {
    manifestInput.outputs.collect_dataset = {
      dataset_path: null,
      rows: 0,
      size_bytes: 0,
    };
    return manifestInput;
  }

  const completedBatchPaths = manifestInput.batches
    .filter(batch => batch.phase === "collect_dataset" && batch.status === "completed")
    .map(batch => batch.output_path)
    .filter(existsSync)
    .sort();

  if (completedBatchPaths.length === 0) {
    throw new Error("No completed raw batch outputs found for build_transitions");
  }

  const rawOutputs = completedBatchPaths.map(filePath => JSON.parse(readFileSync(filePath, "utf8")));
  const transitions = buildModifierStrategicTrainingTransitions(rawOutputs, {
    gamma: Number(postprocessConfig.gamma ?? 0.99),
  });

  const mergedDir = path.join(pipelineRoot, "merged");
  mkdirSync(mergedDir, { recursive: true });
  const datasetPath = postprocessConfig.output_path
    ? resolvePathWithFallbacks(String(postprocessConfig.output_path), [configDir, dataRlDir, repoRoot])
    : path.join(mergedDir, "modifier-strategic-training-transitions.jsonl");

  const payload = transitions.map(entry => JSON.stringify(entry)).join("\n");
  writeFileSync(datasetPath, `${payload}${payload.length > 0 ? "\n" : ""}`, "utf8");

  manifestInput.outputs.collect_dataset = {
    dataset_path: datasetPath,
    rows: transitions.length,
    size_bytes: statSync(datasetPath).size,
    raw_batch_output_paths: completedBatchPaths,
  };

  return manifestInput;
}

function runArchivePhase(currentManifest: Record<string, unknown>) {
  const manifestInput = structuredClone(currentManifest) as Record<string, unknown> & { outputs: Record<string, unknown> };
  const archiveConfig = config.archive as Record<string, unknown>;
  const format = String(archiveConfig.format ?? "tar.gz");
  const artifactsDir = path.join(pipelineRoot, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const outputPath = archiveConfig.output_path
    ? resolvePathWithFallbacks(String(archiveConfig.output_path), [configDir, dataRlDir, repoRoot])
    : path.join(artifactsDir, `modifier-strategic-seeded-runtime.${format === "zip" ? "zip" : "tar.gz"}`);

  const entries = [
    path.relative(pipelineRoot, manifestPath),
    path.relative(pipelineRoot, metricsPath),
    path.relative(pipelineRoot, artifactsSummaryPath),
    "collect_dataset",
    "merged",
  ].filter(entry => existsSync(path.join(pipelineRoot, entry)));

  if (entries.length === 0) {
    throw new Error("No runtime artifacts available for archive_dataset");
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  if (format === "zip") {
    runCommand("zip", ["-rq", outputPath, ...entries], pipelineRoot);
  } else {
    runCommand("tar", ["-czf", outputPath, "-C", pipelineRoot, ...entries], repoRoot);
  }

  manifestInput.outputs.archive_dataset = {
    archive_path: outputPath,
    format,
    size_bytes: statSync(outputPath).size,
  };
  return manifestInput;
}

function markStepStatus(currentManifest: Record<string, unknown>, stepName: string, status: string, errorText: string | null = null) {
  const manifestInput = structuredClone(currentManifest) as Record<string, unknown>;
  const now = new Date().toISOString();
  const existing = (manifestInput.steps as Record<string, Record<string, unknown>> | undefined)?.[stepName] ?? {};
  const startedAt = status === "running" ? now : (existing.started_at as string | undefined) ?? now;
  const durationMs = status === "completed" || status === "failed"
    ? computeDurationMs(startedAt, now)
    : (existing.duration_ms as number | null | undefined) ?? null;

  manifestInput.steps = manifestInput.steps ?? {};
  (manifestInput.steps as Record<string, unknown>)[stepName] = {
    status,
    started_at: startedAt,
    completed_at: status === "completed" || status === "failed" ? now : null,
    duration_ms: durationMs,
    error: errorText,
  };
  return manifestInput;
}

function computeDurationMs(startedAt: string, completedAt: string) {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    return null;
  }
  return Math.max(0, completed - started);
}

function saveManifest(filePath: string, manifestInput: Record<string, unknown>) {
  const nextManifest = {
    ...manifestInput,
    updated_at: new Date().toISOString(),
  };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
}

function writeArtifactsSummary(manifestInput: Record<string, unknown>) {
  const summary = {
    manifest_path: manifestPath,
    updated_at: new Date().toISOString(),
    outputs: manifestInput.outputs ?? {},
    steps: manifestInput.steps ?? {},
    recommended_downloads: {
      dataset: (manifestInput.outputs as Record<string, Record<string, unknown>> | undefined)?.collect_dataset?.dataset_path ?? null,
      dataset_archive: (manifestInput.outputs as Record<string, Record<string, unknown>> | undefined)?.archive_dataset?.archive_path ?? null,
      collection_metrics: metricsPath,
    },
  };
  writeFileSync(artifactsSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function writeCollectionMetrics(currentManifest: Record<string, unknown>) {
  const manifestInput = structuredClone(currentManifest) as Record<string, unknown> & { batches: Batch[]; outputs: Record<string, Record<string, unknown>> };
  const batches = manifestInput.batches ?? [];
  const completedBatches = batches.filter(batch => batch.status === "completed");
  const batchDurations = completedBatches.map(batch => Number(batch.duration_ms)).filter(Number.isFinite);
  const outputs = manifestInput.outputs ?? {};
  const collectOutput = outputs.collect_dataset ?? {};
  const archiveOutput = outputs.archive_dataset ?? {};
  const rawEpisodes = completedBatches.flatMap(batch => loadEpisodesFromOutput(batch.output_path));
  const totalRuntimeMs = computeTotalRuntimeMs(manifestInput);
  const datasetPath = typeof collectOutput.dataset_path === "string" ? collectOutput.dataset_path : null;
  const archivePath = typeof archiveOutput.archive_path === "string" ? archiveOutput.archive_path : null;

  const metrics = {
    run_name: path.basename(pipelineRoot),
    config_path: configPath,
    runtime_dir: pipelineRoot,
    manifest_path: manifestPath,
    dataset_path: datasetPath,
    dataset_rows: Number(collectOutput.rows ?? 0),
    dataset_size_bytes: Number(collectOutput.size_bytes ?? 0),
    dataset_size_mb: Number(collectOutput.size_bytes ?? 0) / (1024 * 1024),
    archive_path: archivePath,
    archive_format: typeof archiveOutput.format === "string" ? archiveOutput.format : null,
    archive_size_bytes: Number(archiveOutput.size_bytes ?? 0),
    archive_size_mb: Number(archiveOutput.size_bytes ?? 0) / (1024 * 1024),
    download_path: archivePath,
    scp_download_command: buildScpDownloadCommand(archivePath),
    scenario_count: seeds.length,
    seed_count: seeds.length,
    waves: [Number((config.collect as Record<string, unknown>).max_waves ?? 0)].filter(Number.isFinite),
    runs_per_seed: Number((config.collect as Record<string, unknown>).runs_per_seed ?? 0),
    batch_size: Number((config.collect as Record<string, unknown>).runs_per_instance ?? 0),
    total_batches: batches.length,
    completed_batches: completedBatches.length,
    failed_batches: batches.filter(batch => batch.status === "failed").length,
    total_episodes: batches.reduce((sum, batch) => sum + Number(batch.runs ?? 0), 0),
    completed_episodes: completedBatches.reduce((sum, batch) => sum + Number(batch.runs ?? 0), 0),
    average_batch_duration_ms: batchDurations.length > 0
      ? Math.round(batchDurations.reduce((sum, value) => sum + value, 0) / batchDurations.length)
      : null,
    total_runtime_ms: totalRuntimeMs > 0 ? totalRuntimeMs : null,
    average_wave_reached: rawEpisodes.length > 0
      ? rawEpisodes.reduce((sum, episode) => sum + Number(episode.wave_reached ?? 0), 0) / rawEpisodes.length
      : null,
    best_wave_reached: rawEpisodes.length > 0
      ? Math.max(...rawEpisodes.map(episode => Number(episode.wave_reached ?? 0)))
      : null,
    worst_wave_reached: rawEpisodes.length > 0
      ? Math.min(...rawEpisodes.map(episode => Number(episode.wave_reached ?? 0)))
      : null,
    technical_termination_count: rawEpisodes.filter(episode => isTechnicalTermination(String(episode.termination_reason ?? ""))).length,
    started_at: (manifestInput.created_at as string | undefined) ?? null,
    updated_at: (manifestInput.updated_at as string | undefined) ?? null,
    completed_at: phases.every(phase => ((manifestInput.steps as Record<string, Record<string, unknown>> | undefined)?.[phase]?.status === "completed"))
      ? (manifestInput.updated_at as string | undefined) ?? null
      : null,
    steps: manifestInput.steps ?? {},
  };

  writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  manifestInput.outputs.collection_metrics = {
    metrics_path: metricsPath,
  };
  return manifestInput;
}

function loadEpisodesFromOutput(filePath: string): Array<Record<string, unknown>> {
  if (!existsSync(filePath)) {
    return [];
  }
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  return Array.isArray(payload.episodes) ? payload.episodes : [];
}

function isTechnicalTermination(reason: string): boolean {
  if (!reason) {
    return true;
  }
  return !["max_waves_reached", "team_wipe_or_game_over", "combat_terminal:GameOverPhase", "combat_terminal:PostGameOverPhase", "combat_terminal:TitlePhase"].includes(reason);
}

function computeTotalRuntimeMs(currentManifest: Record<string, unknown>) {
  const createdAt = Date.parse(String(currentManifest.created_at ?? ""));
  const updatedAt = Date.parse(String(currentManifest.updated_at ?? ""));
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return 0;
  }
  return Math.max(0, updatedAt - createdAt);
}

async function notifyIfConfigured({ event, phase, error = null }: { event: string; phase: string; error?: string | null }) {
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

function buildScpDownloadCommand(downloadPath: string | null) {
  if (typeof downloadPath !== "string" || downloadPath.length === 0) {
    return null;
  }

  const sshTarget = process.env.POKEROGUE_REMOTE_SSH_TARGET ?? "SFH-Frederik@152.53.176.72";
  const sshKeyPath = process.env.POKEROGUE_REMOTE_SSH_KEY ?? "/Users/frederikhartung/.ssh/id_rsa_github_privat";
  const localImportDir = process.env.POKEROGUE_MODIFIER_COLLECTION_LOCAL_IMPORT_DIR ?? "/Users/frederikhartung/Documents/GitRepos/Privat/pokeRogueBot/data/rl/modifier/";
  return `scp -i ${shellQuote(sshKeyPath)} ${shellQuote(`${sshTarget}:${downloadPath}`)} ${shellQuote(localImportDir)}`;
}

function shellQuote(value: string) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function resolvePathWithFallbacks(pathValue: string, bases: string[]) {
  if (path.isAbsolute(pathValue)) {
    return pathValue;
  }
  for (const base of bases) {
    const candidate = path.resolve(base, pathValue);
    if (existsSync(candidate) || existsSync(path.dirname(candidate))) {
      return candidate;
    }
  }
  return path.resolve(bases[0]!, pathValue);
}

function runCommand(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed (${command} ${args.join(" ")}) with exit code ${result.status ?? 1}`);
  }
}

function terminateRunningBatchChildren(
  running: Map<string, { batch: Batch; child: ChildProcess; promise: Promise<void> }>,
  failedBatchId: string,
) {
  for (const [batchId, entry] of running.entries()) {
    if (batchId === failedBatchId) {
      continue;
    }
    terminateChildProcess(entry.child);
  }
}

function terminateChildProcess(child: ChildProcess) {
  if (!child.pid) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // process group may already be gone
    }
    setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        // process group already gone
      }
    }, 2000).unref();
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // already exited
  }
  setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // already exited
    }
  }, 2000).unref();
}
