import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const defaultPythonCommand = resolvePythonCommand();

const defaultConfigPath = path.join(repoRoot, "data", "rl", "wave-library-iterative-pipeline-run.json");
const cli = parseCli(process.argv.slice(2));
const configPath = path.resolve(cli.configPath ?? defaultConfigPath);

if (!existsSync(configPath)) {
  throw new Error(`Pipeline config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);
const dataRlDir = path.join(repoRoot, "data", "rl");
const iterations = Number(config.iterations ?? 5);
if (!Number.isInteger(iterations) || iterations < 0) {
  throw new Error(`Invalid iterations value in ${configPath}`);
}

const pipelineRoot = resolvePathWithFallbacks(
  config.output_root ?? "./pipeline-runs/wave-library-iterative",
  [configDir, dataRlDir, repoRoot],
);
const manifestPath = resolvePathWithFallbacks(
  config.manifest_path ?? path.join(pipelineRoot, "manifest.json"),
  [configDir, dataRlDir, repoRoot],
);
mkdirSync(pipelineRoot, { recursive: true });

const scenarios = resolveScenarios(config, configDir, dataRlDir);
if (scenarios.length === 0) {
  throw new Error(`No scenarios resolved for pipeline config: ${configPath}`);
}

const phasePlan = buildPhasePlan(iterations);
const artifactsSummaryPath = path.join(pipelineRoot, "artifacts-summary.json");
const benchmarkSummaryPath = path.join(pipelineRoot, "benchmark-summary.json");

let manifest = loadManifest(manifestPath, configPath);
manifest = syncManifest(manifest, config, scenarios, pipelineRoot, phasePlan);
saveManifest(manifestPath, manifest);
writeArtifactsSummary(manifest);

if (cli.prepareOnly) {
  console.log(`Prepared manifest: ${manifestPath}`);
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Phases: ${phasePlan.length}`);
  console.log(`Collect batches: ${manifest.batches.length}`);
  process.exit(0);
}

await main();

async function main() {
  for (const phase of phasePlan) {
    manifest = loadManifest(manifestPath, configPath);
    if (manifest.steps?.[phase]?.status === "completed") {
      console.log(`Skipping completed phase: ${phase}`);
      if (cli.stopAfterPhase === phase) {
        break;
      }
      continue;
    }

    manifest = markStepStatus(manifest, phase, "running");
    saveManifest(manifestPath, manifest);

    try {
      if (isCollectPhase(phase)) {
        manifest = await runCollectPhase(manifest, config, configDir, dataRlDir, phase);
      } else if (phase === "baseline_report") {
        manifest = runReportPhase(manifest, "baseline_collect");
      } else if (phase === "train_baseline") {
        manifest = runTrainPhase(manifest, config, configDir, "baseline_collect", "train_baseline", null);
      } else if (phase === "benchmark_baseline") {
        manifest = runBenchmarkPhase(manifest, config, configDir, "benchmark_baseline", null);
      } else if (phase.startsWith("report_iter_")) {
        const iteration = parseIterationFromPhase(phase, "report_iter_");
        manifest = runReportPhase(manifest, collectPhaseName(iteration));
      } else if (phase.startsWith("merge_cumulative_")) {
        const iteration = parseIterationFromPhase(phase, "merge_cumulative_");
        manifest = mergeCumulativeDatasets(manifest, iteration);
      } else if (phase.startsWith("train_iter_")) {
        const iteration = parseIterationFromPhase(phase, "train_iter_");
        manifest = runTrainPhase(
          manifest,
          config,
          configDir,
          cumulativeOutputKey(iteration),
          trainOutputKey(iteration),
          iteration,
        );
      } else if (phase.startsWith("benchmark_iter_")) {
        const iteration = parseIterationFromPhase(phase, "benchmark_iter_");
        manifest = runBenchmarkPhase(manifest, config, configDir, benchmarkOutputKey(iteration), iteration);
      } else {
        throw new Error(`Unsupported phase: ${phase}`);
      }

      manifest = markStepStatus(manifest, phase, "completed");
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
      await notifyIfConfigured({
        event: phase.startsWith("benchmark_iter_") ? "iteration_completed" : null,
        phase,
        iteration: phase.startsWith("benchmark_iter_") ? parseIterationFromPhase(phase, "benchmark_iter_") : null,
      });
    } catch (error) {
      manifest = markStepStatus(manifest, phase, "failed", String(error?.message ?? error));
      saveManifest(manifestPath, manifest);
      writeArtifactsSummary(manifest);
      await notifyIfConfigured({
        event: "pipeline_failed",
        phase,
        error: String(error?.message ?? error),
      });
      throw error;
    }

    if (cli.stopAfterPhase === phase) {
      break;
    }
  }

  if (cli.stopAfterPhase == null) {
    manifest = loadManifest(manifestPath, configPath);
    const allCompleted = phasePlan.every(phase => manifest.steps?.[phase]?.status === "completed");
    if (allCompleted) {
      await notifyIfConfigured({
        event: "pipeline_completed",
        phase: "completed",
      });
    }
  }
}

function parseCli(args) {
  const state = {
    configPath: null,
    prepareOnly: false,
    stopAfterPhase: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--prepare-only") {
      state.prepareOnly = true;
      continue;
    }
    if (arg === "--stop-after-phase") {
      state.stopAfterPhase = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (!arg.startsWith("--") && state.configPath == null) {
      state.configPath = arg;
    }
  }

  return state;
}

function buildPhasePlan(totalIterations) {
  const phases = [
    "baseline_collect",
    "baseline_report",
    "train_baseline",
    "benchmark_baseline",
  ];

  for (let iteration = 1; iteration <= totalIterations; iteration += 1) {
    phases.push(collectPhaseName(iteration));
    phases.push(`report_iter_${iteration}`);
    phases.push(`merge_cumulative_${iteration}`);
    phases.push(trainOutputKey(iteration));
    phases.push(benchmarkOutputKey(iteration));
  }

  return phases;
}

function collectPhaseName(iteration) {
  return `collect_iter_${iteration}`;
}

function cumulativeOutputKey(iteration) {
  return `cumulative_iter_${iteration}`;
}

function trainOutputKey(iteration) {
  return `train_iter_${iteration}`;
}

function benchmarkOutputKey(iteration) {
  return `benchmark_iter_${iteration}`;
}

function parseIterationFromPhase(phaseName, prefix) {
  const value = Number(phaseName.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid iterative phase name: ${phaseName}`);
  }
  return value;
}

function isCollectPhase(phaseName) {
  return phaseName === "baseline_collect" || phaseName.startsWith("collect_iter_");
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

function syncManifest(currentManifest, rootConfig, scenariosInput, outputRoot, phases) {
  const manifest = {
    ...currentManifest,
    config_path: configPath,
    updated_at: new Date().toISOString(),
    outputs: currentManifest.outputs ?? {},
    steps: currentManifest.steps ?? {},
  };

  const baselineBatches = buildBatchesForPhase(
    "baseline_collect",
    rootConfig.baseline_collect,
    scenariosInput,
    outputRoot,
  );
  const iterativeBatches = [];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    iterativeBatches.push(
      ...buildBatchesForPhase(
        collectPhaseName(iteration),
        rootConfig.iterative_collect,
        scenariosInput,
        outputRoot,
      ),
    );
  }

  const plannedBatches = [...baselineBatches, ...iterativeBatches];
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

  for (const phase of phases) {
    if (manifest.steps[phase] == null) {
      manifest.steps[phase] = {
        status: "pending",
        error: null,
        updated_at: new Date().toISOString(),
      };
    }
  }

  return manifest;
}

function buildBatchesForPhase(phaseName, phaseConfig, scenariosInput, outputRoot) {
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

  for (const scenario of scenariosInput) {
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

async function runCollectPhase(currentManifest, rootConfig, configDirInput, localDataRlDir, phaseName) {
  const manifest = structuredClone(currentManifest);
  const phaseConfig = phaseName === "baseline_collect" ? rootConfig.baseline_collect : rootConfig.iterative_collect;
  const pendingBatches = manifest.batches.filter(batch => batch.phase === phaseName && batch.status !== "completed");
  const parallelism = Math.max(1, Number(phaseConfig.parallelism ?? rootConfig.collect_parallelism ?? 1));

  await runWithConcurrency(pendingBatches, parallelism, async (batch) => {
    const batchRef = manifest.batches.find(entry => entry.id === batch.id);
    batchRef.status = "running";
    batchRef.started_at = new Date().toISOString();
    batchRef.error = null;
    saveManifest(manifestPath, manifest);

    const collectorConfig = buildCollectorConfigForBatch({
      rootConfig,
      configDir: configDirInput,
      dataRlDir: localDataRlDir,
      phaseConfig,
      phaseName,
      batch,
      manifest,
    });
    writeFileSync(batch.run_config_path, `${JSON.stringify(collectorConfig, null, 2)}\n`, "utf8");

    const startedAt = Date.now();
    try {
      await runCommandAsync("node", ["scripts/01-data-generation/collector/run-pokerogue-experience-collector.mjs", batch.run_config_path], repoRoot);
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
  });

  manifest.outputs[phaseName] = mergePhaseDatasets(
    manifest,
    phaseName,
    [{ phaseName, sourceLabel: datasetSourceLabelForPhase(phaseName) }],
  ).outputs[phaseName];
  return manifest;
}

function buildCollectorConfigForBatch({
  rootConfig,
  configDir: configDirInput,
  dataRlDir: localDataRlDir,
  phaseConfig,
  phaseName,
  batch,
  manifest,
}) {
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
    rootConfig,
    configDir: configDirInput,
    dataRlDir: localDataRlDir,
    phaseConfig,
    phaseName,
    manifest,
  });

  return collectorConfig;
}

function resolvePolicyForPhase({ rootConfig, configDir: configDirInput, dataRlDir: localDataRlDir, phaseConfig, phaseName, manifest }) {
  const policy = structuredClone(phaseConfig.policy ?? {});

  if (phaseName === "baseline_collect") {
    return policy;
  }

  if (policy.type !== "epsilon_random") {
    return policy;
  }

  const iteration = parseIterationFromPhase(phaseName, "collect_iter_");
  const resolvedEpsilon = resolveEpsilonForIteration(policy, iteration);
  if (resolvedEpsilon != null) {
    policy.epsilon = resolvedEpsilon;
  }
  const previousTrainKey = iteration === 1 ? "train_baseline" : trainOutputKey(iteration - 1);
  const checkpointPath = manifest.outputs?.[previousTrainKey]?.model_output_path;
  if (!checkpointPath || !existsSync(checkpointPath)) {
    throw new Error(`${phaseName} requires completed checkpoint from ${previousTrainKey}`);
  }

  const exploitPolicy = structuredClone(policy.exploit_policy ?? {});
  if (exploitPolicy.type !== "external_command") {
    return policy;
  }

  const inferScriptPath = path.join(repoRoot, "scripts", "dqn_policy_infer_worker.py");
  const device = phaseConfig.device ?? rootConfig.device ?? "cpu";
  exploitPolicy.command = [
    "python3",
    inferScriptPath,
    "--checkpoint",
    checkpointPath,
    "--device",
    device,
  ];
  exploitPolicy.persistent = true;

  policy.exploit_policy = exploitPolicy;
  return policy;
}

function resolveEpsilonForIteration(policy, iteration) {
  if (Array.isArray(policy.epsilon_by_iteration)) {
    const raw = policy.epsilon_by_iteration[iteration - 1];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
  }

  if (typeof policy.epsilon_by_iteration === "object" && policy.epsilon_by_iteration !== null) {
    const raw = policy.epsilon_by_iteration[String(iteration)];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
  }

  if (typeof policy.epsilon_start === "number" && typeof policy.epsilon_end === "number" && Number.isFinite(policy.epsilon_start) && Number.isFinite(policy.epsilon_end)) {
    if (iterations <= 1) {
      return policy.epsilon_end;
    }
    const progress = (iteration - 1) / Math.max(1, iterations - 1);
    return policy.epsilon_start + ((policy.epsilon_end - policy.epsilon_start) * progress);
  }

  return typeof policy.epsilon === "number" && Number.isFinite(policy.epsilon) ? policy.epsilon : null;
}

function runReportPhase(currentManifest, outputKey) {
  const manifest = structuredClone(currentManifest);
  const phaseOutput = manifest.outputs?.[outputKey];
  if (!phaseOutput?.dataset_path) {
    throw new Error(`No merged dataset available for ${outputKey}`);
  }

  const reportPath = path.join(path.dirname(phaseOutput.dataset_path), `${outputKey}-report.json`);
  runCommand(
    "node",
    [
      "scripts/01-data-generation/dataset/report-rl-dataset.mjs",
      "--input",
      phaseOutput.dataset_path,
      "--manifest",
      manifestPath,
      "--phase",
      outputKey,
      "--output",
      reportPath,
    ],
    repoRoot,
  );
  manifest.outputs[outputKey] = {
    ...phaseOutput,
    report_path: reportPath,
  };
  return manifest;
}

function runTrainPhase(currentManifest, rootConfig, configDirInput, datasetOutputKey, trainKey, iteration) {
  const manifest = structuredClone(currentManifest);
  const datasetPath = manifest.outputs?.[datasetOutputKey]?.dataset_path;
  if (!datasetPath || !existsSync(datasetPath)) {
    throw new Error(`Dataset missing for training stage ${trainKey}`);
  }

  const trainConfigEntry = iteration == null ? rootConfig.train_baseline : rootConfig.train_iteration;
  if (!trainConfigEntry) {
    throw new Error(`Missing training config for ${trainKey}`);
  }
  const templatePath = resolvePathWithFallbacks(trainConfigEntry.template_config_path, [configDirInput, dataRlDir, repoRoot]);
  const templateConfig = JSON.parse(readFileSync(templatePath, "utf8"));
  const generatedConfigPath = path.join(pipelineRoot, `${trainKey}-config.json`);
  const outputPath = iteration == null
    ? resolveOptionalPatternPath(trainConfigEntry.output_path, null, configDirInput)
    : resolveOptionalPatternPath(trainConfigEntry.output_path_pattern, iteration, configDirInput);

  const generatedConfig = {
    ...templateConfig,
    dataset_path: datasetPath,
    output_path: outputPath,
  };
  writeFileSync(generatedConfigPath, `${JSON.stringify(generatedConfig, null, 2)}\n`, "utf8");

  runCommand(defaultPythonCommand, ["scripts/02-training/offline-dqn/train_dqn_offline.py", "--config", generatedConfigPath], repoRoot);

  manifest.outputs[trainKey] = {
    config_path: generatedConfigPath,
    dataset_path: datasetPath,
    model_output_path: outputPath,
  };
  return manifest;
}

function runBenchmarkPhase(currentManifest, rootConfig, configDirInput, benchmarkKey, iteration) {
  const manifest = structuredClone(currentManifest);
  const benchmarkConfig = iteration == null ? rootConfig.benchmark_baseline : rootConfig.benchmark_iteration;
  if (!benchmarkConfig) {
    throw new Error(`Missing benchmark config for ${benchmarkKey}`);
  }

  const trainingKey = iteration == null ? "train_baseline" : trainOutputKey(iteration);
  const collectorConfigPath = resolvePathWithFallbacks(benchmarkConfig.collector_config_path, [configDirInput, dataRlDir, repoRoot]);
  const checkpointPath = manifest.outputs?.[trainingKey]?.model_output_path;
  if (!checkpointPath || !existsSync(checkpointPath)) {
    throw new Error(`Benchmark ${benchmarkKey} requires completed checkpoint ${trainingKey}`);
  }

  const reportPath = iteration == null
    ? resolveOptionalPatternPath(benchmarkConfig.report_path, null, configDirInput)
    : resolveOptionalPatternPath(benchmarkConfig.report_path_pattern, iteration, configDirInput);

  if (iteration == null || benchmarkConfig.reuse_baseline_policies !== true) {
    runCommand(
      defaultPythonCommand,
      [
        "scripts/03-benchmark/eval/eval_policy_compare.py",
        "--collector-config",
        collectorConfigPath,
        "--checkpoint",
        checkpointPath,
        "--report-path",
        reportPath,
        "--max-steps-per-episode",
        String(benchmarkConfig.max_steps_per_episode ?? 400),
        "--parallelism",
        String(benchmarkConfig.parallelism ?? rootConfig.benchmark_parallelism ?? 1),
      ],
      repoRoot,
    );
  } else {
    const dqnOutputPath = resolveOptionalPatternPath(benchmarkConfig.dqn_output_path_pattern, iteration, configDirInput);
    const dqnReportPath = resolveOptionalPatternPath(benchmarkConfig.dqn_report_path_pattern, iteration, configDirInput);
    const baselineReportPath = manifest.outputs?.benchmark_baseline?.report_path;
    if (!baselineReportPath || !existsSync(baselineReportPath)) {
      throw new Error(`Benchmark ${benchmarkKey} requires completed baseline benchmark report`);
    }

    runCommand(
      defaultPythonCommand,
      [
        "scripts/03-benchmark/eval/eval_dqn_policy.py",
        "--collector-config",
        collectorConfigPath,
        "--checkpoint",
        checkpointPath,
        "--output-path",
        dqnOutputPath,
        "--report-path",
        dqnReportPath,
        "--parallelism",
        String(benchmarkConfig.parallelism ?? rootConfig.benchmark_parallelism ?? 1),
      ],
      repoRoot,
    );

    const mergedReport = buildCachedBenchmarkReport({
      baselineReportPath,
      dqnReportPath,
      collectorConfigPath,
      checkpointPath,
    });
    writeFileSync(reportPath, `${JSON.stringify(mergedReport, null, 2)}\n`, "utf8");
  }

  manifest.outputs[benchmarkKey] = {
    report_path: reportPath,
    collector_config_path: collectorConfigPath,
    checkpoint_path: checkpointPath,
  };
  return refreshBenchmarkSummary(manifest);
}

function buildCachedBenchmarkReport({ baselineReportPath, dqnReportPath, collectorConfigPath, checkpointPath }) {
  const baselineReport = JSON.parse(readFileSync(baselineReportPath, "utf8"));
  const dqnEvalReport = JSON.parse(readFileSync(dqnReportPath, "utf8"));
  const randomResult = baselineReport?.results?.random;
  const alwaysResult = baselineReport?.results?.always_move_0;
  const dqnResult = dqnEvalReport?.summary;

  if (!randomResult || !alwaysResult || !dqnResult) {
    throw new Error("Cached benchmark report could not be assembled from baseline and dqn reports");
  }

  return {
    collector_config: collectorConfigPath,
    checkpoint: checkpointPath,
    baseline_report: baselineReportPath,
    dqn_report: dqnReportPath,
    results: {
      random: randomResult,
      always_move_0: alwaysResult,
      dqn: dqnResult,
    },
    comparison: {
      dqn_vs_random: {
        win_rate_delta: dqnResult.win_rate - randomResult.win_rate,
        avg_reward_delta: dqnResult.avg_reward - randomResult.avg_reward,
        avg_turns_delta: dqnResult.avg_turns - randomResult.avg_turns,
      },
      dqn_vs_always_move_0: {
        win_rate_delta: dqnResult.win_rate - alwaysResult.win_rate,
        avg_reward_delta: dqnResult.avg_reward - alwaysResult.avg_reward,
        avg_turns_delta: dqnResult.avg_turns - alwaysResult.avg_turns,
      },
    },
    quality_gates: {
      max_truncated_rate: baselineReport?.quality_gates?.max_truncated_rate ?? 0.10,
      violations: dqnResult.truncated_rate > (baselineReport?.quality_gates?.max_truncated_rate ?? 0.10)
        ? [{
            policy: "dqn",
            metric: "truncated_rate",
            value: dqnResult.truncated_rate,
          }]
        : [],
    },
  };
}

function mergeCumulativeDatasets(currentManifest, iteration) {
  const sources = [{
    phaseName: "baseline_collect",
    sourceLabel: datasetSourceLabelForPhase("baseline_collect"),
  }];

  for (let current = 1; current <= iteration; current += 1) {
    sources.push({
      phaseName: collectPhaseName(current),
      sourceLabel: datasetSourceLabelForPhase(collectPhaseName(current)),
    });
  }

  return mergePhaseDatasets(currentManifest, cumulativeOutputKey(iteration), sources);
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

  runCommand("node", ["scripts/01-data-generation/dataset/run-rl-dataset-sanity.mjs", datasetPath], repoRoot);

  manifest.outputs[outputKey] = {
    dataset_path: datasetPath,
    rows: rowCount,
  };
  return manifest;
}

function datasetSourceLabelForPhase(phaseName) {
  if (phaseName === "baseline_collect") {
    return "baseline_random";
  }
  if (phaseName.startsWith("collect_iter_")) {
    return `${phaseName}_epsilon_random`;
  }
  return phaseName;
}

function refreshBenchmarkSummary(currentManifest) {
  const manifest = structuredClone(currentManifest);
  const benchmarkKeys = ["benchmark_baseline"];
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    benchmarkKeys.push(benchmarkOutputKey(iteration));
  }

  const rows = [];
  let baselineDqn = null;
  let previousDqn = null;

  for (const key of benchmarkKeys) {
    const reportPath = manifest.outputs?.[key]?.report_path;
    if (!reportPath || !existsSync(reportPath)) {
      continue;
    }

    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const dqn = report?.results?.dqn ?? {};
    const row = {
      benchmark_key: key,
      iteration: key === "benchmark_baseline" ? 0 : parseIterationFromPhase(key, "benchmark_iter_"),
      checkpoint_path: manifest.outputs?.[key]?.checkpoint_path ?? null,
      report_path: reportPath,
      win_rate: numberOrNull(dqn.win_rate),
      avg_reward: numberOrNull(dqn.avg_reward),
      avg_turns: numberOrNull(dqn.avg_turns),
      truncated_rate: numberOrNull(dqn.truncated_rate),
      transitions: Number.isInteger(dqn.transitions) ? dqn.transitions : null,
      delta_vs_baseline: null,
      delta_vs_previous: null,
    };

    if (baselineDqn == null) {
      baselineDqn = row;
    } else {
      row.delta_vs_baseline = buildDelta(row, baselineDqn);
    }

    if (previousDqn != null) {
      row.delta_vs_previous = buildDelta(row, previousDqn);
    }

    rows.push(row);
    previousDqn = row;
  }

  const summaryPath = path.join(pipelineRoot, "benchmark-summary.json");
  writeFileSync(summaryPath, `${JSON.stringify({ benchmarks: rows }, null, 2)}\n`, "utf8");
  manifest.outputs.benchmark_summary = {
    report_path: summaryPath,
    benchmarks: rows.length,
  };
  return manifest;
}

function buildDelta(current, reference) {
  return {
    win_rate: subtractNullable(current.win_rate, reference.win_rate),
    avg_reward: subtractNullable(current.avg_reward, reference.avg_reward),
    avg_turns: subtractNullable(current.avg_turns, reference.avg_turns),
    truncated_rate: subtractNullable(current.truncated_rate, reference.truncated_rate),
  };
}

function subtractNullable(left, right) {
  return typeof left === "number" && typeof right === "number" ? left - right : null;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

  async function startNext() {
    const item = queue.shift();
    if (item == null) {
      return;
    }
    const promise = worker(item).finally(() => {
      const index = active.indexOf(promise);
      if (index >= 0) {
        active.splice(index, 1);
      }
    });
    active.push(promise);
  }

  while (queue.length > 0 || active.length > 0) {
    while (queue.length > 0 && active.length < concurrency) {
      await startNext();
    }
    if (active.length > 0) {
      await Promise.race(active);
    }
  }
}

function resolveOptionalPatternPath(template, iteration, baseDir) {
  if (typeof template !== "string" || template.length === 0) {
    throw new Error("Missing required path template");
  }
  const value = iteration == null ? template : template.replaceAll("{iteration}", String(iteration));
  return resolvePathWithFallbacks(value, [baseDir, dataRlDir, repoRoot]);
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

function resolvePythonCommand() {
  const configured = process.env.POKEROGUE_PYTHON_BIN;
  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }
  const venvPython3 = path.join(repoRoot, ".venv", "bin", "python3");
  if (existsSync(venvPython3)) {
    return venvPython3;
  }
  const venvPython = path.join(repoRoot, ".venv", "bin", "python");
  if (existsSync(venvPython)) {
    return venvPython;
  }
  return "python3";
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
  const summaryPath = artifactsSummaryPath;
  const latestIteration = findLatestCompletedIteration(manifest);
  const summary = {
    manifest_path: manifestPath,
    updated_at: new Date().toISOString(),
    outputs: manifest.outputs ?? {},
    steps: manifest.steps ?? {},
    recommended_downloads: {
      baseline_dataset_report: manifest.outputs?.baseline_collect?.report_path ?? null,
      baseline_benchmark_report: manifest.outputs?.benchmark_baseline?.report_path ?? null,
      latest_iteration_dataset_report: latestIteration != null
        ? manifest.outputs?.[collectPhaseName(latestIteration)]?.report_path ?? null
        : null,
      latest_iteration_model: latestIteration != null
        ? manifest.outputs?.[trainOutputKey(latestIteration)]?.model_output_path ?? null
        : manifest.outputs?.train_baseline?.model_output_path ?? null,
      latest_iteration_benchmark_report: latestIteration != null
        ? manifest.outputs?.[benchmarkOutputKey(latestIteration)]?.report_path ?? null
        : null,
      benchmark_summary: manifest.outputs?.benchmark_summary?.report_path ?? null,
    },
  };
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function findLatestCompletedIteration(manifest) {
  for (let iteration = iterations; iteration >= 1; iteration -= 1) {
    if (manifest.outputs?.[benchmarkOutputKey(iteration)]?.report_path) {
      return iteration;
    }
  }
  return null;
}

async function notifyIfConfigured({ event, phase, iteration = null, error = null }) {
  if (typeof event !== "string" || event.length === 0) {
    return;
  }

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
    "--artifacts-summary",
    artifactsSummaryPath,
  ];

  if (existsSync(benchmarkSummaryPath)) {
    args.push("--benchmark-summary", benchmarkSummaryPath);
  }
  if (iteration != null) {
    args.push("--iteration", String(iteration));
  }
  if (typeof error === "string" && error.length > 0) {
    args.push("--error", error);
  }

  try {
    await runCommandAsync("node", args, repoRoot, "inherit");
  } catch (notificationError) {
    console.warn(`Notification failed for ${event}: ${String(notificationError?.message ?? notificationError)}`);
  }
}

function toNumberSet(values) {
  if (!Array.isArray(values)) {
    return new Set();
  }
  return new Set(values.map(value => Number(value)).filter(value => Number.isInteger(value)));
}

function markStepStatus(currentManifest, phaseName, status, error = null) {
  const manifest = structuredClone(currentManifest);
  const previous = manifest.steps[phaseName] ?? {};
  const nowIso = new Date().toISOString();
  const startedAt = status === "running"
    ? (previous.started_at ?? nowIso)
    : (previous.started_at ?? null);
  let completedAt = previous.completed_at ?? null;
  let durationMs = previous.duration_ms ?? null;

  if (status === "completed" || status === "failed") {
    completedAt = nowIso;
    if (startedAt != null) {
      const startedMs = Date.parse(startedAt);
      const completedMs = Date.parse(completedAt);
      if (Number.isFinite(startedMs) && Number.isFinite(completedMs) && completedMs >= startedMs) {
        durationMs = completedMs - startedMs;
      }
    }
  }

  manifest.steps[phaseName] = {
    ...previous,
    status,
    error,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
    updated_at: nowIso,
  };
  return manifest;
}
