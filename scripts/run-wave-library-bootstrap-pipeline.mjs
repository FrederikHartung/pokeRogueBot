import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "wave-library-bootstrap-pipeline-run.json");
const cli = parseCli(process.argv.slice(2));
const configPath = path.resolve(cli.configPath ?? defaultConfigPath);

if (!existsSync(configPath)) {
  throw new Error(`Pipeline config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);
const dataRlDir = path.join(repoRoot, "data", "rl");
const pipelineRoot = resolvePathWithFallbacks(config.output_root ?? "./pipeline-runs/wave-library-bootstrap", [configDir, dataRlDir, repoRoot]);
const manifestPath = resolvePathWithFallbacks(config.manifest_path ?? path.join(pipelineRoot, "manifest.json"), [configDir, dataRlDir, repoRoot]);
mkdirSync(pipelineRoot, { recursive: true });

const scenarios = resolveScenarios(config, configDir);
if (scenarios.length === 0) {
  throw new Error(`No scenarios resolved for pipeline config: ${configPath}`);
}

let manifest = loadManifest(manifestPath, configPath);
manifest = syncManifest(manifest, config, scenarios, pipelineRoot);
saveManifest(manifestPath, manifest);

if (cli.prepareOnly) {
  console.log(`Prepared manifest: ${manifestPath}`);
  console.log(`Random batches: ${manifest.batches.filter(batch => batch.phase === "random_collect").length}`);
  console.log(`DQN batches: ${manifest.batches.filter(batch => batch.phase === "dqn_collect").length}`);
  writeArtifactsSummary(manifest);
  process.exit(0);
}

const phases = [
  "random_collect",
  "random_report",
  "train_initial",
  "benchmark_initial",
  "dqn_collect",
  "dqn_report",
  "merge_final",
  "train_final",
  "benchmark_final",
];

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
    if (phaseName === "random_collect" || phaseName === "dqn_collect") {
      manifest = runCollectPhase(manifest, config, configDir, phaseName);
    } else if (phaseName === "random_report") {
      manifest = runReportPhase(manifest, "random_collect");
    } else if (phaseName === "dqn_report") {
      manifest = runReportPhase(manifest, "dqn_collect");
    } else if (phaseName === "train_initial") {
      manifest = runTrainPhase(manifest, config, configDir, "random_collect", "initial");
    } else if (phaseName === "benchmark_initial") {
      manifest = runBenchmarkPhase(manifest, config, configDir, "benchmark_initial");
    } else if (phaseName === "merge_final") {
      manifest = mergePhaseDatasets(manifest, "final_combined", [
        { phaseName: "random_collect", sourceLabel: "random_bootstrap" },
        { phaseName: "dqn_collect", sourceLabel: "model_guided_bootstrap" },
      ]);
    } else if (phaseName === "train_final") {
      manifest = runTrainPhase(manifest, config, configDir, "final_combined", "final");
    } else if (phaseName === "benchmark_final") {
      manifest = runBenchmarkPhase(manifest, config, configDir, "benchmark_final");
    }

    manifest = markStepStatus(manifest, phaseName, "completed");
    saveManifest(manifestPath, manifest);
    writeArtifactsSummary(manifest);
  } catch (error) {
    manifest = markStepStatus(manifest, phaseName, "failed", String(error?.message ?? error));
    saveManifest(manifestPath, manifest);
    writeArtifactsSummary(manifest);
    throw error;
  }

  if (cli.stopAfterPhase === phaseName) {
    break;
  }
}

function parseCli(args) {
  const cliState = {
    configPath: null,
    prepareOnly: false,
    stopAfterPhase: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--prepare-only") {
      cliState.prepareOnly = true;
      continue;
    }
    if (arg === "--stop-after-phase") {
      cliState.stopAfterPhase = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (!arg.startsWith("--") && cliState.configPath == null) {
      cliState.configPath = arg;
    }
  }

  return cliState;
}

function resolveScenarios(rootConfig, baseDir) {
  const includeWaves = toNumberSet(rootConfig.include_waves);
  const excludeWaves = toNumberSet(rootConfig.exclude_waves);
  const resolved = [];

  for (const dirEntry of rootConfig.scenario_dirs ?? []) {
    const resolvedDir = resolvePathWithFallbacks(dirEntry, [baseDir, dataRlDir, repoRoot]);
    if (!existsSync(resolvedDir)) {
      continue;
    }
    for (const name of readdirSync(resolvedDir).filter(name => name.endsWith(".json")).sort()) {
      resolved.push(path.join(resolvedDir, name));
    }
  }

  for (const fileEntry of rootConfig.scenario_files ?? []) {
    const fullPath = resolvePathWithFallbacks(fileEntry, [baseDir, dataRlDir, repoRoot]);
    if (existsSync(fullPath)) {
      resolved.push(fullPath);
    }
  }

  const uniquePaths = Array.from(new Set(resolved));
  return uniquePaths
    .map(filePath => {
      const raw = JSON.parse(readFileSync(filePath, "utf8"));
      return {
        path: filePath,
        scenario_name: path.basename(filePath, ".json"),
        wave_index: Number(raw.wave_index),
        difficulty_group: String(raw.difficulty_group ?? "core"),
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

function syncManifest(currentManifest, rootConfig, scenarios, outputRoot) {
  const manifest = {
    ...currentManifest,
    updated_at: new Date().toISOString(),
    outputs: currentManifest.outputs ?? {},
    steps: currentManifest.steps ?? {},
  };

  const randomBatches = buildBatchesForPhase("random_collect", rootConfig.random_collect, scenarios, outputRoot);
  const dqnBatches = buildBatchesForPhase("dqn_collect", rootConfig.dqn_collect, scenarios, outputRoot);
  const plannedBatches = [...randomBatches, ...dqnBatches];
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

function buildBatchesForPhase(phaseName, phaseConfig, scenarios, outputRoot) {
  if (!phaseConfig || phaseConfig.enabled === false) {
    return [];
  }

  const episodesPerInstance = Number(phaseConfig.episodes_per_instance ?? 0);
  const batchSize = Number(phaseConfig.batch_size ?? 0);
  if (!Number.isInteger(episodesPerInstance) || episodesPerInstance <= 0) {
    throw new Error(`Invalid episodes_per_instance for ${phaseName}`);
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid batch_size for ${phaseName}`);
  }

  const batches = [];
  let globalEpisodeCursor = 0;

  for (const scenario of scenarios) {
    const batchCount = Math.ceil(episodesPerInstance / batchSize);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
      const remaining = episodesPerInstance - (batchIndex * batchSize);
      const episodes = Math.min(batchSize, remaining);
      const phaseOutputDir = path.join(outputRoot, phaseName);
      const batchesDir = path.join(phaseOutputDir, "batches");
      const configsDir = path.join(phaseOutputDir, "configs");
      mkdirSync(batchesDir, { recursive: true });
      mkdirSync(configsDir, { recursive: true });

      const batchId = `${phaseName}::${scenario.scenario_name}::${String(batchIndex + 1).padStart(3, "0")}`;
      batches.push({
        id: batchId,
        phase: phaseName,
        wave_index: scenario.wave_index,
        scenario_name: scenario.scenario_name,
        scenario_path: scenario.path,
        batch_index: batchIndex,
        episodes,
        global_episode_start: globalEpisodeCursor,
        output_path: path.join(batchesDir, `${scenario.scenario_name}--batch-${String(batchIndex + 1).padStart(3, "0")}.jsonl`),
        run_config_path: path.join(configsDir, `${scenario.scenario_name}--batch-${String(batchIndex + 1).padStart(3, "0")}.json`),
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

function runCollectPhase(currentManifest, rootConfig, configDir, phaseName) {
  const manifest = structuredClone(currentManifest);
  const phaseConfig = phaseName === "random_collect" ? rootConfig.random_collect : rootConfig.dqn_collect;
  const pendingBatches = manifest.batches.filter(batch => batch.phase === phaseName && batch.status !== "completed");

  for (const batch of pendingBatches) {
    const batchRef = manifest.batches.find(entry => entry.id === batch.id);
    batchRef.status = "running";
    batchRef.started_at = new Date().toISOString();
    batchRef.error = null;
    saveManifest(manifestPath, manifest);

    const collectorConfig = buildCollectorConfigForBatch({
      rootConfig,
      configDir,
      phaseConfig,
      phaseName,
      batch,
      manifest,
    });
    writeFileSync(batch.run_config_path, `${JSON.stringify(collectorConfig, null, 2)}\n`, "utf8");

    const startedAt = Date.now();
    try {
      runCommand("node", ["scripts/run-pokerogue-experience-collector.mjs", batch.run_config_path], repoRoot);
      batchRef.status = "completed";
      batchRef.completed_at = new Date().toISOString();
      batchRef.duration_ms = Date.now() - startedAt;
      batchRef.error = null;
    } catch (error) {
      batchRef.status = "failed";
      batchRef.completed_at = new Date().toISOString();
      batchRef.duration_ms = Date.now() - startedAt;
      batchRef.error = String(error?.message ?? error);
      saveManifest(manifestPath, manifest);
      throw error;
    }

    saveManifest(manifestPath, manifest);
  }

  manifest.outputs[phaseName] = mergePhaseDatasets(manifest, phaseName, [
    {
      phaseName,
      sourceLabel: phaseName === "random_collect" ? "random_bootstrap" : "model_guided_bootstrap",
    },
  ]).outputs[phaseName];

  return manifest;
}

function buildCollectorConfigForBatch({ rootConfig, configDir, phaseConfig, phaseName, batch, manifest }) {
  const collectorTemplate = {
    ...(rootConfig.collector_defaults ?? {}),
    ...(phaseConfig.collector ?? {}),
  };
  const collectorConfig = {
    ...collectorTemplate,
    scenario_files: [batch.scenario_path],
    output_path: batch.output_path,
    append_output: false,
    episodes_per_seed: batch.episodes,
    episode_index_offset: batch.global_episode_start,
  };

  if (collectorConfig.test_timeout_ms == null) {
    collectorConfig.test_timeout_ms = 600000;
  }

  collectorConfig.policy = resolvePolicyForPhase({
    phaseConfig,
    phaseName,
    rootConfig,
    configDir,
    manifest,
  });

  return collectorConfig;
}

function resolvePolicyForPhase({ phaseConfig, phaseName, rootConfig, configDir, manifest }) {
  const policy = structuredClone(phaseConfig.policy ?? {});

  if (phaseName !== "dqn_collect") {
    return policy;
  }

  if (policy.type !== "external_command") {
    return policy;
  }

  const initialTraining = manifest.outputs?.train_initial;
  const checkpointPath = initialTraining?.model_output_path;
  if (!checkpointPath || !existsSync(checkpointPath)) {
    throw new Error("DQN collect requires completed initial training checkpoint");
  }

  const inferScriptPath = path.join(repoRoot, "scripts", "dqn_policy_infer_worker.py");
  const device = phaseConfig.device ?? rootConfig.device ?? "cpu";
  policy.command = [
    "python3",
    inferScriptPath,
    "--checkpoint",
    checkpointPath,
    "--device",
    device,
  ];
  policy.persistent = true;
  return policy;
}

function runReportPhase(currentManifest, phaseName) {
  const manifest = structuredClone(currentManifest);
  const phaseOutput = manifest.outputs?.[phaseName];
  if (!phaseOutput?.dataset_path) {
    throw new Error(`No merged dataset available for ${phaseName}`);
  }

  const reportPath = path.join(path.dirname(phaseOutput.dataset_path), `${phaseName}-report.json`);
  runCommand(
    "node",
    [
      "scripts/report-rl-dataset.mjs",
      "--input",
      phaseOutput.dataset_path,
      "--manifest",
      manifestPath,
      "--phase",
      phaseName,
      "--output",
      reportPath,
    ],
    repoRoot,
  );
  manifest.outputs[phaseName] = {
    ...phaseOutput,
    report_path: reportPath,
  };
  return manifest;
}

function runTrainPhase(currentManifest, rootConfig, configDir, datasetPhaseName, trainingStage) {
  const manifest = structuredClone(currentManifest);
  const datasetPath = manifest.outputs?.[datasetPhaseName]?.dataset_path;
  if (!datasetPath || !existsSync(datasetPath)) {
    throw new Error(`Dataset missing for training stage ${trainingStage}`);
  }

  const trainConfigEntry = trainingStage === "initial" ? rootConfig.train_initial : rootConfig.train_final;
  const templatePath = resolvePathWithFallbacks(trainConfigEntry.template_config_path, [configDir, dataRlDir, repoRoot]);
  const templateConfig = JSON.parse(readFileSync(templatePath, "utf8"));
  const generatedConfigPath = path.join(pipelineRoot, `${trainingStage}-train-config.json`);
  const modelOutputPath = resolvePathWithFallbacks(trainConfigEntry.output_path, [configDir, dataRlDir, repoRoot]);

  const generatedConfig = {
    ...templateConfig,
    dataset_path: datasetPath,
    output_path: modelOutputPath,
  };
  writeFileSync(generatedConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`, "utf8");

  runCommand("python3", ["scripts/train_dqn_offline.py", "--config", generatedConfigPath], repoRoot);

  manifest.outputs[`train_${trainingStage}`] = {
    config_path: generatedConfigPath,
    dataset_path: datasetPath,
    model_output_path: modelOutputPath,
  };
  return manifest;
}

function runBenchmarkPhase(currentManifest, rootConfig, configDir, benchmarkPhaseName) {
  const manifest = structuredClone(currentManifest);
  const benchmarkConfig = rootConfig[benchmarkPhaseName];
  if (!benchmarkConfig) {
    throw new Error(`Missing pipeline benchmark config: ${benchmarkPhaseName}`);
  }

  const trainingStage = benchmarkPhaseName === "benchmark_initial" ? "initial" : "final";
  const collectorConfigPath = resolvePathWithFallbacks(benchmarkConfig.collector_config_path, [configDir, dataRlDir, repoRoot]);
  const checkpointPath = manifest.outputs?.[`train_${trainingStage}`]?.model_output_path;
  if (!checkpointPath || !existsSync(checkpointPath)) {
    throw new Error(`Benchmark ${benchmarkPhaseName} requires a trained model checkpoint`);
  }

  const reportPath = resolvePathWithFallbacks(benchmarkConfig.report_path, [configDir, dataRlDir, repoRoot]);

  runCommand(
    "python3",
    [
      "scripts/eval_policy_compare.py",
      "--collector-config",
      collectorConfigPath,
      "--checkpoint",
      checkpointPath,
      "--report-path",
      reportPath,
      "--max-steps-per-episode",
      String(benchmarkConfig.max_steps_per_episode ?? 400),
    ],
    repoRoot,
  );

  manifest.outputs[benchmarkPhaseName] = {
    report_path: reportPath,
    collector_config_path: collectorConfigPath,
    checkpoint_path: checkpointPath,
  };
  return manifest;
}

function mergePhaseDatasets(currentManifest, outputKey, sources) {
  const manifest = structuredClone(currentManifest);
  let rowCount = 0;

  const mergedDir = path.join(pipelineRoot, "merged");
  mkdirSync(mergedDir, { recursive: true });
  const datasetPath = path.join(mergedDir, `${outputKey}.jsonl`);
  writeFileSync(datasetPath, "", "utf8");
  for (const source of sources) {
    const matchingBatches = manifest.batches
      .filter(batch => batch.phase === source.phaseName && batch.status === "completed")
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const batch of matchingBatches) {
      if (!existsSync(batch.output_path)) {
        continue;
      }
      const lines = readFileSync(batch.output_path, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const row = JSON.parse(line);
        row.episode_id = `${row.episode_id}::${source.sourceLabel}`;
        row.meta = {
          ...(row.meta ?? {}),
          dataset_source: source.sourceLabel,
        };
        appendFileSync(datasetPath, `${JSON.stringify(row)}\n`, "utf8");
        rowCount += 1;
      }
    }
  }

  runCommand("node", ["scripts/run-rl-dataset-sanity.mjs", datasetPath], repoRoot);

  manifest.outputs[outputKey] = {
    dataset_path: datasetPath,
    rows: rowCount,
  };
  return manifest;
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

function resolveOutputPath(value, baseDir) {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function resolvePathWithFallbacks(value, baseDirs) {
  if (path.isAbsolute(value)) {
    return value;
  }
  for (const baseDir of baseDirs) {
    const resolved = path.resolve(baseDir, value);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return path.resolve(baseDirs[0], value);
}

function saveManifest(filePath, manifest) {
  const nextManifest = {
    ...manifest,
    updated_at: new Date().toISOString(),
  };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
}

function writeArtifactsSummary(manifest) {
  const summaryPath = path.join(pipelineRoot, "artifacts-summary.json");
  const summary = {
    manifest_path: manifestPath,
    updated_at: new Date().toISOString(),
    outputs: manifest.outputs ?? {},
    steps: manifest.steps ?? {},
    recommended_downloads: {
      random_report: manifest.outputs?.random_collect?.report_path ?? null,
      dqn_report: manifest.outputs?.dqn_collect?.report_path ?? null,
      final_model: manifest.outputs?.train_final?.model_output_path ?? null,
      initial_smoke_benchmark_report: manifest.outputs?.benchmark_initial?.report_path ?? null,
      final_full_benchmark_report: manifest.outputs?.benchmark_final?.report_path ?? null,
    },
  };
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function toNumberSet(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }
  return new Set(values.map(value => Number(value)).filter(value => Number.isInteger(value)));
}

function markStepStatus(currentManifest, phaseName, status, error = null) {
  const manifest = structuredClone(currentManifest);
  manifest.steps[phaseName] = {
    ...(manifest.steps[phaseName] ?? {}),
    status,
    error,
    updated_at: new Date().toISOString(),
  };
  return manifest;
}
