import https from "node:https";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const iterativeControlDir = path.join(repoRoot, "data", "rl", "pipeline-runs", "wave-library-iterative-remote-control");
const randomCollectionControlDir = path.join(repoRoot, "data", "rl", "pipeline-runs", "wave-library-random-collection-remote-control");
const trainingControlDir = path.join(repoRoot, "data", "rl", "training-runs", "offline-dqn-remote-control");

const cli = parseCli(process.argv.slice(2));
const token = process.env.POKEROGUE_TELEGRAM_BOT_TOKEN ?? "";
const allowedChatId = process.env.POKEROGUE_TELEGRAM_CHAT_ID ?? "";
const enabled = isEnabled(process.env.POKEROGUE_TELEGRAM_ENABLED);

if (!enabled) {
  console.log("Telegram control bot disabled. Exiting.");
  process.exit(0);
}
if (!token || !allowedChatId) {
  throw new Error("Missing POKEROGUE_TELEGRAM_BOT_TOKEN or POKEROGUE_TELEGRAM_CHAT_ID");
}

const stateDir = cli.stateDir ?? iterativeControlDir;
const offsetPath = path.join(stateDir, "telegram-control-offset.txt");
const activeConfigPathFile = path.join(stateDir, "active-config.txt");
const defaultConfigPath = path.join(repoRoot, "data", "rl", "wave-library-iterative-pipeline-remote-10ep.json");
mkdirSync(stateDir, { recursive: true });

let offset = loadOffset(offsetPath);

console.log(`Telegram control bot started. Poll interval: ${cli.pollIntervalSeconds}s`);

for (;;) {
  try {
    const updates = await getUpdates({ token, offset, timeoutSeconds: Math.min(cli.pollIntervalSeconds, 50) });
    for (const update of updates) {
      offset = Math.max(offset, Number(update.update_id ?? 0) + 1);
      writeFileSync(offsetPath, `${offset}\n`, "utf8");
      await handleUpdate(update);
    }
  } catch (error) {
    console.error(`Telegram control bot loop failed: ${String(error?.message ?? error)}`);
  }

  await sleep(cli.pollIntervalSeconds * 1000);
}

async function handleUpdate(update) {
  const message = update?.message;
  const chatId = String(message?.chat?.id ?? "");
  const text = String(message?.text ?? "").trim();

  if (!text || chatId !== allowedChatId) {
    return;
  }

  const command = normalizeCommand(text);
  const allowedCommands = new Set(["status", "issues", "last", "benchmarks", "loss", "help"]);
  if (!allowedCommands.has(command)) {
    await sendMessage({
      token,
      chatId,
      text: ["Unknown command.", "Allowed commands:", "/status", "/loss", "/benchmarks", "/issues", "/last", "/help"].join("\n"),
    });
    return;
  }

  if (command === "help") {
    await sendMessage({
      token,
      chatId,
      text: ["Available commands:", "/status", "/loss", "/benchmarks", "/issues", "/last"].join("\n"),
    });
    return;
  }

  try {
    const reply = command === "status"
      ? buildCompactStatusReply()
      : command === "loss"
        ? buildLossReply()
      : command === "benchmarks"
        ? buildBenchmarksReply()
        : runRemoteHelper(command);
    await sendMessage({
      token,
      chatId,
      text: reply,
    });
  } catch (error) {
    const errorText = `Telegram command '${command}' failed: ${String(error?.message ?? error)}`;
    console.error(errorText);
    await sendMessage({
      token,
      chatId,
      text: truncate(errorText, 3500),
    });
  }
}

function parseCli(args) {
  const state = {
    pollIntervalSeconds: 600,
    stateDir: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--poll-interval-seconds") {
      const value = Number(args[i + 1] ?? "");
      if (Number.isInteger(value) && value > 0) {
        state.pollIntervalSeconds = value;
      }
      i += 1;
      continue;
    }
    if (arg === "--state-dir") {
      state.stateDir = path.resolve(args[i + 1] ?? "");
      i += 1;
    }
  }

  return state;
}

function isEnabled(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function loadOffset(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }
  const raw = readFileSync(filePath, "utf8").trim();
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeCommand(text) {
  return text
    .replace(/^\/+/, "")
    .split(/\s+/, 1)[0]
    .toLowerCase();
}

function runRemoteHelper(command) {
  const helperScript = stateDir === randomCollectionControlDir
    ? "scripts/01-data-generation/pipeline/run-wave-library-random-collection-remote.sh"
    : stateDir === trainingControlDir
      ? "scripts/02-training/offline-dqn/run-train-dqn-offline-remote.sh"
      : "scripts/01-data-generation/pipeline/run-wave-library-bootstrap-remote.sh";

  const result = spawnSync("bash", [helperScript, command], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if ((result.status ?? 1) !== 0) {
    return truncate([stdout.trim(), stderr.trim()].filter(Boolean).join("\n"), 3500);
  }
  return truncate(stdout.trim() || "No output.", 3500);
}

function buildCompactStatusReply() {
  const statusBlocks = listManagedRuns()
    .map(buildStatusBlock)
    .filter(Boolean);

  if (statusBlocks.length === 0) {
    return "No managed remote pipeline state found yet.";
  }
  return truncate(statusBlocks.join("\n\n"), 3500);
}

function buildBenchmarksReply() {
  if (stateDir === trainingControlDir) {
    return "Benchmarks are not available for offline DQN training runs.";
  }

  const configPath = loadActiveConfigPath();
  const runtimeDir = runtimeDirForConfig(configPath);
  const benchmarkSummaryPath = path.join(runtimeDir, "benchmark-summary.json");
  const runName = path.basename(runtimeDir);

  if (!existsSync(benchmarkSummaryPath)) {
    return [`Run: ${runName}`, "Benchmarks: not available yet"].join("\n");
  }

  const summary = JSON.parse(readFileSync(benchmarkSummaryPath, "utf8"));
  const rows = Array.isArray(summary?.benchmarks) ? summary.benchmarks : [];
  if (rows.length === 0) {
    return [`Run: ${runName}`, "Benchmarks: not available yet"].join("\n");
  }

  const lines = [`Run: ${runName}`, "Benchmarks:"];
  for (const row of rows) {
    const label = Number(row.iteration) === 0 ? "baseline" : `iter ${row.iteration}`;
    lines.push(
      `${label}: wr=${formatNumber(row.win_rate)} reward=${formatNumber(row.avg_reward)} turns=${formatNumber(row.avg_turns)}`,
    );
  }
  return truncate(lines.join("\n"), 3500);
}

function buildLossReply() {
  const runs = listManagedRuns().filter(run => run.kind === "offline_dqn_training");
  if (runs.length === 0) {
    return "No managed offline DQN training run found.";
  }

  const run = runs[0];
  const progressPath = path.join(run.runtimeDir, "training-progress.json");
  const summaryPath = path.join(run.runtimeDir, "training-summary.json");
  const sourcePath = existsSync(progressPath) ? progressPath : summaryPath;
  if (!existsSync(sourcePath)) {
    return [`Run: ${run.runName}`, "Losses: not available yet"].join("\n");
  }

  const payload = JSON.parse(readFileSync(sourcePath, "utf8"));
  const metrics = Array.isArray(payload?.epoch_metrics) ? payload.epoch_metrics : [];
  if (metrics.length === 0) {
    return [`Run: ${run.runName}`, "Losses: not available yet"].join("\n");
  }

  const lines = [`Run: ${run.runName}`, `State: ${run.state}`, "Epoch losses:"];
  for (const chunk of chunkEpochLosses(metrics, 8)) {
    lines.push(chunk);
  }
  return truncate(lines.join("\n"), 3500);
}

function loadActiveConfigPath() {
  if (existsSync(activeConfigPathFile)) {
    return readFileSync(activeConfigPathFile, "utf8").trim();
  }
  return defaultConfigPath;
}

function loadActiveConfigPathForControlDir(controlDir, fallbackConfigPath) {
  const filePath = path.join(controlDir, "active-config.txt");
  if (existsSync(filePath)) {
    return readFileSync(filePath, "utf8").trim();
  }
  return fallbackConfigPath;
}

function listManagedRuns() {
  const runs = [
    {
      kind: "iterative",
      controlDir: iterativeControlDir,
      fallbackConfigPath: path.join(repoRoot, "data", "rl", "wave-library-iterative-pipeline-remote-10ep.json"),
    },
    {
      kind: "random_collection",
      controlDir: randomCollectionControlDir,
      fallbackConfigPath: path.join(repoRoot, "data", "rl", "wave-library-random-collection-remote-50ep.json"),
    },
    {
      kind: "offline_dqn_training",
      controlDir: trainingControlDir,
      fallbackConfigPath: path.join(repoRoot, "data", "rl", "train-dqn-offline-wave-library-random-valid-action-v3-server.json"),
    },
  ].map(describeManagedRun);

  const priority = { running: 0, failed: 1, completed: 2, not_started: 3 };
  return runs
    .filter(run => run.hasManifest || run.isRunning || run.hasActiveConfig)
    .sort((left, right) => {
      const leftPriority = priority[left.state] ?? 99;
      const rightPriority = priority[right.state] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.runName.localeCompare(right.runName);
    });
}

function describeManagedRun({ kind, controlDir, fallbackConfigPath }) {
  const configPath = loadActiveConfigPathForControlDir(controlDir, fallbackConfigPath);
  const runtimeDir = runtimeDirForConfig(configPath);
  const manifestPath = path.join(runtimeDir, "manifest.json");
  const statePath = path.join(runtimeDir, "training-state.json");
  const pidFile = path.join(
    controlDir,
    kind === "iterative"
      ? "remote-pipeline.pid"
      : kind === "random_collection"
        ? "remote-random-collection.pid"
        : "remote-offline-dqn-training.pid",
  );
  const hasActiveConfig = existsSync(path.join(controlDir, "active-config.txt"));
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const trainingState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
  const isRunning = readRunningPid(pidFile) != null;
  const state = inferManagedRunState({ kind, manifest, trainingState, isRunning });

  return {
    kind,
    configPath,
    runtimeDir,
    manifestPath,
    manifest,
    trainingState,
    isRunning,
    state,
    hasManifest: manifest != null || trainingState != null,
    hasActiveConfig,
    runName: path.basename(runtimeDir),
  };
}

function readRunningPid(pidFilePath) {
  if (!existsSync(pidFilePath)) {
    return null;
  }
  const raw = readFileSync(pidFilePath, "utf8").trim();
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }
  const result = spawnSync("kill", ["-0", String(pid)], {
    encoding: "utf8",
  });
  return (result.status ?? 1) === 0 ? pid : null;
}

function inferManagedRunState({ kind, manifest, trainingState, isRunning }) {
  if (isRunning) {
    return "running";
  }
  if (kind === "offline_dqn_training") {
    if (!trainingState) {
      return "not_started";
    }
    return trainingState.status ?? "not_started";
  }
  if (!manifest) {
    return "not_started";
  }
  return inferPipelineState(manifest);
}

function buildStatusBlock(run) {
  if (!run.hasManifest && !run.isRunning) {
    return null;
  }

  if (run.kind === "random_collection") {
    return buildRandomCollectionStatusBlock(run);
  }
  if (run.kind === "offline_dqn_training") {
    return buildTrainingStatusBlock(run);
  }
  return buildIterativeStatusBlock(run);
}

function buildIterativeStatusBlock(run) {
  const manifest = run.manifest;
  const lines = [`Run: ${run.runName}`];
  if (!manifest) {
    lines.push(`State: ${run.state}`);
    return lines.join("\n");
  }

  const progress = summarizeProgress(manifest);
  const state = run.state;
  const phase = inferCurrentPhase(manifest);
  const iteration = inferIterationFromPhase(phase);
  const totalIterations = inferIterationCount(manifest);

  lines.push(`State: ${state}`);
  lines.push(`Phase: ${phase ?? "unknown"}`);
  if (iteration != null && totalIterations != null) {
    lines.push(`Iteration: ${iteration}/${totalIterations}`);
  } else if (state === "completed" && totalIterations != null) {
    lines.push(`Iteration: ${totalIterations}/${totalIterations}`);
  }
  if (progress) {
    lines.push(`Batches: ${progress.completedBatches}/${progress.totalBatches}`);
    lines.push(`Episodes: ${progress.completedEpisodes}/${progress.totalEpisodes}`);
  }

  if (state === "running") {
    const eta = summarizeEta(manifest);
    if (eta != null) {
      lines.push(`ETA: ${formatDuration(eta)}`);
    }
  }

  if (state === "failed") {
    const failedStep = inferFailedStep(manifest);
    if (failedStep) {
      lines.push(`Failed step: ${failedStep.name}`);
      lines.push(`Error: ${truncate(failedStep.error ?? "unknown error", 220)}`);
    }
  }

  return lines.join("\n");
}

function buildRandomCollectionStatusBlock(run) {
  const manifest = run.manifest;
  const lines = [`Run: ${run.runName}`];
  if (!manifest) {
    lines.push(`State: ${run.state}`);
    return lines.join("\n");
  }

  const progress = summarizeProgress(manifest);
  const state = run.state;
  const phase = inferCurrentPhase(manifest);

  lines.push(`State: ${state === "completed" ? "collection completed" : state}`);
  lines.push(`Phase: ${phase ?? "unknown"}`);
  if (progress) {
    lines.push(`Batches: ${progress.completedBatches}/${progress.totalBatches}`);
    lines.push(`Episodes: ${progress.completedEpisodes}/${progress.totalEpisodes}`);
  }

  const scenarioCount = summarizeScenarioCount(manifest);
  if (scenarioCount != null) {
    lines.push(`Scenarios: ${scenarioCount}`);
  }

  if (state === "running") {
    const eta = summarizeEta(manifest);
    if (eta != null) {
      lines.push(`ETA: ${formatDuration(eta)}`);
    }
  }

  if (state === "failed") {
    const failedStep = inferFailedStep(manifest);
    if (failedStep) {
      lines.push(`Failed step: ${failedStep.name}`);
      lines.push(`Error: ${truncate(failedStep.error ?? "unknown error", 220)}`);
    }
  }

  return lines.join("\n");
}

function buildTrainingStatusBlock(run) {
  const lines = [`Run: ${run.runName}`];
  const state = run.state;
  lines.push(`State: ${state}`);

  const trainingState = run.trainingState ?? {};
  if (trainingState.dataset_path) {
    lines.push(`Dataset: ${path.basename(trainingState.dataset_path)}`);
  }
  if (trainingState.output_path) {
    lines.push(`Checkpoint: ${path.basename(trainingState.output_path)}`);
  }

  const progressPath = path.join(run.runtimeDir, "training-progress.json");
  const summaryPath = path.join(run.runtimeDir, "training-summary.json");
  const metricSourcePath = existsSync(progressPath) ? progressPath : summaryPath;
  if (existsSync(metricSourcePath)) {
    const summary = JSON.parse(readFileSync(metricSourcePath, "utf8"));
    const metrics = Array.isArray(summary?.epoch_metrics) ? summary.epoch_metrics : [];
    lines.push(`Epochs: ${metrics.length}/${summary.epochs ?? "?"}`);
    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      lines.push(`Latest mean loss: ${formatNumber(latest.mean_loss, 6)}`);
      const recentLosses = chunkEpochLosses(metrics.slice(-5), 5);
      if (recentLosses.length > 0) {
        lines.push(`Recent losses: ${recentLosses[0]}`);
      }
    }
    if (typeof summary.total_runtime_ms === "number") {
      lines.push(`Total runtime: ${formatDuration(summary.total_runtime_ms)}`);
    }
    return lines.join("\n");
  }

  const progress = summarizeTrainingProgress(path.join(run.runtimeDir, "offline-dqn-training.log"));
  if (progress) {
    lines.push(`Epochs: ${progress.currentEpoch}/${progress.totalEpochs}`);
    lines.push(`Latest mean loss: ${formatNumber(progress.meanLoss, 6)}`);
  }

  if (state === "failed" && trainingState.error) {
    lines.push(`Error: ${truncate(trainingState.error, 220)}`);
  }

  return lines.join("\n");
}

function runtimeDirForConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const config = JSON.parse(readFileSync(absoluteConfigPath, "utf8"));

  if (typeof config.remote_runtime_dir === "string" && config.remote_runtime_dir.length > 0) {
    return resolvePathWithFallbacks(config.remote_runtime_dir, [repoRoot, path.dirname(absoluteConfigPath)]);
  }

  if (typeof config.output_root === "string" && config.output_root.length > 0) {
    return resolvePathWithFallbacks(config.output_root, [path.dirname(absoluteConfigPath), path.join(repoRoot, "data", "rl"), repoRoot]);
  }

  if (typeof config.output_path === "string" && config.output_path.length > 0) {
    const checkpointBase = path.basename(config.output_path).replace(/\.[^.]+$/, "");
    return path.join(repoRoot, "data", "rl", "training-runs", checkpointBase);
  }

  return path.join(repoRoot, "data", "rl", "pipeline-runs", "wave-library-iterative");
}

function resolvePathWithFallbacks(value, baseDirs) {
  if (path.isAbsolute(value)) {
    return value;
  }
  for (const baseDir of baseDirs) {
    const candidate = path.resolve(baseDir, value);
    if (existsSync(candidate) || existsSync(path.dirname(candidate))) {
      return candidate;
    }
  }
  return path.resolve(baseDirs[0], value);
}

function summarizeProgress(manifest) {
  if (!manifest || !Array.isArray(manifest.batches)) {
    return null;
  }
  return {
    totalBatches: manifest.batches.length,
    completedBatches: manifest.batches.filter(batch => batch.status === "completed").length,
    totalEpisodes: manifest.batches.reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0),
    completedEpisodes: manifest.batches
      .filter(batch => batch.status === "completed")
      .reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0),
  };
}

function summarizeScenarioCount(manifest) {
  if (!manifest || !Array.isArray(manifest.batches)) {
    return null;
  }
  return new Set(
    manifest.batches
      .map(batch => batch?.scenario_name)
      .filter(value => typeof value === "string" && value.length > 0),
  ).size;
}

function inferPipelineState(manifest) {
  const steps = Object.values(manifest?.steps ?? {});
  if (steps.some(step => step?.status === "failed")) {
    return "failed";
  }
  if (steps.length > 0 && steps.every(step => step?.status === "completed")) {
    return "completed";
  }
  return "running";
}

function inferCurrentPhase(manifest) {
  for (const [name, step] of Object.entries(manifest?.steps ?? {})) {
    if (step?.status === "running") {
      return name;
    }
  }
  for (const [name, step] of Object.entries(manifest?.steps ?? {})) {
    if (step?.status !== "completed") {
      return name;
    }
  }
  return "completed";
}

function inferIterationFromPhase(phase) {
  if (typeof phase !== "string") {
    return null;
  }
  const match = phase.match(/(?:collect_iter_|report_iter_|merge_cumulative_|train_iter_|benchmark_iter_)(\d+)$/);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function inferIterationCount(manifest) {
  let maxIteration = 0;
  for (const name of Object.keys(manifest?.steps ?? {})) {
    const iteration = inferIterationFromPhase(name);
    if (iteration != null) {
      maxIteration = Math.max(maxIteration, iteration);
    }
  }
  return maxIteration > 0 ? maxIteration : null;
}

function inferFailedStep(manifest) {
  const failedEntries = Object.entries(manifest?.steps ?? {}).filter(([, step]) => step?.status === "failed");
  if (failedEntries.length === 0) {
    return null;
  }
  const [name, step] = failedEntries[failedEntries.length - 1];
  return {
    name,
    error: typeof step?.error === "string" ? step.error : null,
  };
}

function summarizeEta(manifest) {
  const batches = manifest?.batches ?? [];
  const completedDurations = batches
    .filter(batch => batch?.status === "completed" && typeof batch?.duration_ms === "number")
    .map(batch => batch.duration_ms);
  const remaining = batches.filter(batch => batch?.status !== "completed").length;
  if (completedDurations.length === 0 || remaining <= 0) {
    return null;
  }
  const averageDurationMs = completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length;
  return averageDurationMs * remaining;
}

function summarizeTrainingProgress(logPath) {
  if (!existsSync(logPath)) {
    return null;
  }
  const pattern = /epoch=(\d+)\/(\d+)\s+mean_loss=([0-9.]+)/;
  let latest = null;
  for (const line of readFileSync(logPath, "utf8").split(/\r?\n/)) {
    const match = pattern.exec(line);
    if (!match) {
      continue;
    }
    latest = {
      currentEpoch: Number(match[1]),
      totalEpochs: Number(match[2]),
      meanLoss: Number(match[3]),
    };
  }
  return latest;
}

function chunkEpochLosses(metrics, chunkSize) {
  const entries = metrics.map(metric => `e${metric.epoch}=${formatNumber(metric.mean_loss, 6)}`);
  const chunks = [];
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize).join(", "));
  }
  return chunks;
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

function formatNumber(value, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function truncate(value, maxLength) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getUpdates({ token, offset: currentOffset, timeoutSeconds }) {
  return new Promise((resolve, reject) => {
    const pathValue = `/bot${token}/getUpdates?offset=${currentOffset}&timeout=${timeoutSeconds}`;
    const request = https.request(
      {
        hostname: "api.telegram.org",
        path: pathValue,
        method: "GET",
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.ok !== true || !Array.isArray(parsed.result)) {
              reject(new Error(`Unexpected getUpdates response: ${truncate(body, 500)}`));
              return;
            }
            resolve(parsed.result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function sendMessage({ token, chatId, text }) {
  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${token}/sendMessage`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          const statusCode = response.statusCode ?? 500;
          if (statusCode >= 200 && statusCode < 300) {
            resolve();
            return;
          }
          reject(new Error(`Telegram sendMessage failed with status ${statusCode}: ${truncate(body, 500)}`));
        });
      },
    );
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
