import https from "node:https";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const cli = parseCli(process.argv.slice(2));

if (!cli.event) {
  throw new Error("Missing required --event <name>");
}

const enabled = isEnabled(process.env.POKEROGUE_TELEGRAM_ENABLED);
const token = process.env.POKEROGUE_TELEGRAM_BOT_TOKEN ?? "";
const chatId = process.env.POKEROGUE_TELEGRAM_CHAT_ID ?? "";

if (!enabled) {
  console.log("Telegram notifications disabled. Skipping.");
  process.exit(0);
}

if (!token || !chatId) {
  console.log("Telegram notifications enabled but token/chat id missing. Skipping.");
  process.exit(0);
}

const manifest = loadOptionalJson(cli.manifestPath);
const benchmarkSummary = loadOptionalJson(cli.benchmarkSummaryPath);

const message = buildMessage({
  event: cli.event,
  runtimeDir: cli.runtimeDir,
  manifestPath: cli.manifestPath,
  phase: cli.phase,
  iteration: cli.iteration,
  error: cli.errorText,
  manifest,
  benchmarkSummary,
});

await sendTelegramMessage({
  token,
  chatId,
  text: message,
});

console.log(`Telegram notification sent for event: ${cli.event}`);

function parseCli(args) {
  const state = {
    event: null,
    manifestPath: null,
    runtimeDir: null,
    phase: null,
    iteration: null,
    errorText: null,
    benchmarkSummaryPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--event") {
      state.event = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--manifest") {
      state.manifestPath = resolveOptionalPath(args[index + 1] ?? null);
      index += 1;
      continue;
    }
    if (arg === "--runtime-dir") {
      state.runtimeDir = resolveOptionalPath(args[index + 1] ?? null);
      index += 1;
      continue;
    }
    if (arg === "--phase") {
      state.phase = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--iteration") {
      const value = Number(args[index + 1] ?? "");
      state.iteration = Number.isInteger(value) ? value : null;
      index += 1;
      continue;
    }
    if (arg === "--error") {
      state.errorText = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--benchmark-summary") {
      state.benchmarkSummaryPath = resolveOptionalPath(args[index + 1] ?? null);
      index += 1;
    }
  }

  return state;
}

function resolveOptionalPath(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return path.resolve(value);
}

function isEnabled(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function loadOptionalJson(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function buildMessage({ event, runtimeDir, manifestPath, phase, iteration, error, manifest, benchmarkSummary }) {
  const runName = runtimeDir ? path.basename(runtimeDir) : "unknown-run";
  const progress = summarizeProgress(manifest);
  const lines = [`Run: ${runName}`];

  if (event === "iteration_completed") {
    lines.push("State: iteration completed");
    lines.push(`Iteration: ${iteration ?? "?"}/${inferIterationCount(manifest) ?? "?"}`);
    const benchmark = summarizeLatestBenchmark(iteration, benchmarkSummary);
    if (benchmark) {
      lines.push(`DQN win_rate: ${formatNumber(benchmark.win_rate)}`);
      lines.push(`DQN avg_reward: ${formatNumber(benchmark.avg_reward)}`);
      lines.push(`DQN avg_turns: ${formatNumber(benchmark.avg_turns)}`);
    }
    const iterationRuntime = summarizeIterationRuntime(manifest, iteration);
    if (iterationRuntime != null) {
      lines.push(`Iteration runtime: ${formatDuration(iterationRuntime)}`);
    }
  } else if (event === "pipeline_failed") {
    lines.push("State: failed");
    lines.push(`Phase: ${phase ?? inferCurrentPhase(manifest) ?? "unknown"}`);
    const currentIteration = iteration ?? inferIterationFromPhase(phase ?? inferCurrentPhase(manifest));
    if (currentIteration != null) {
      lines.push(`Iteration: ${currentIteration}/${inferIterationCount(manifest) ?? "?"}`);
    }
    if (progress) {
      lines.push(`Batches: ${progress.completedBatches}/${progress.totalBatches}`);
      lines.push(`Episodes: ${progress.completedEpisodes}/${progress.totalEpisodes}`);
    }
    const failedStep = inferFailedStep(manifest);
    if (failedStep) {
      lines.push(`Failed step: ${failedStep.name}`);
    }
    lines.push(`Error: ${truncate(error ?? failedStep?.error ?? "unknown error", 220)}`);
  } else if (event === "pipeline_completed") {
    lines.push("State: completed");
    if (progress) {
      lines.push(`Batches: ${progress.completedBatches}/${progress.totalBatches}`);
      lines.push(`Episodes: ${progress.completedEpisodes}/${progress.totalEpisodes}`);
    }
    const totalRuntime = summarizeTotalRuntime(manifest);
    if (totalRuntime != null) {
      lines.push(`Total runtime: ${formatDuration(totalRuntime)}`);
    }
    const iterationDurations = summarizeAllIterationRuntimes(manifest);
    if (iterationDurations.length > 0) {
      lines.push(`Iterations: ${iterationDurations.map(item => `${item.iteration}=${formatDuration(item.durationMs)}`).join(", ")}`);
    }
  } else {
    lines.push(`State: ${event}`);
    if (phase) {
      lines.push(`Phase: ${phase}`);
    }
    if (manifestPath) {
      lines.push(`Manifest: ${manifestPath}`);
    }
  }

  const host = process.env.HOSTNAME || process.env.HOST || null;
  if (host) {
    lines.push(`Host: ${host}`);
  }
  return lines.join("\n");
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

function summarizeLatestBenchmark(iteration, benchmarkSummary) {
  const rows = benchmarkSummary?.benchmarks;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  if (iteration != null) {
    return rows.find(row => Number(row.iteration) === iteration) ?? null;
  }
  return rows[rows.length - 1] ?? null;
}

function summarizeIterationRuntime(manifest, iteration) {
  if (!manifest || iteration == null) {
    return null;
  }
  const stepNames = [
    `collect_iter_${iteration}`,
    `report_iter_${iteration}`,
    `merge_cumulative_${iteration}`,
    `train_iter_${iteration}`,
    `benchmark_iter_${iteration}`,
  ];
  const durations = stepNames
    .map(name => manifest.steps?.[name]?.duration_ms)
    .filter(value => typeof value === "number" && Number.isFinite(value));
  return durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) : null;
}

function summarizeAllIterationRuntimes(manifest) {
  const totalIterations = inferIterationCount(manifest) ?? 0;
  const rows = [];
  for (let iteration = 1; iteration <= totalIterations; iteration += 1) {
    const durationMs = summarizeIterationRuntime(manifest, iteration);
    if (durationMs != null) {
      rows.push({ iteration, durationMs });
    }
  }
  return rows;
}

function summarizeTotalRuntime(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  const durations = Object.values(manifest.steps ?? {})
    .map(step => step?.duration_ms)
    .filter(value => typeof value === "number" && Number.isFinite(value));
  return durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) : null;
}

function inferIterationCount(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  let maxIteration = 0;
  for (const name of Object.keys(manifest.steps ?? {})) {
    const iteration = inferIterationFromPhase(name);
    if (iteration != null) {
      maxIteration = Math.max(maxIteration, iteration);
    }
  }
  return maxIteration > 0 ? maxIteration : null;
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

function inferCurrentPhase(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  for (const [name, step] of Object.entries(manifest.steps ?? {})) {
    if (step?.status === "running") {
      return name;
    }
  }
  for (const [name, step] of Object.entries(manifest.steps ?? {})) {
    if (step?.status !== "completed") {
      return name;
    }
  }
  return "completed";
}

function inferFailedStep(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }
  const failedEntries = Object.entries(manifest.steps ?? {}).filter(([, step]) => step?.status === "failed");
  if (failedEntries.length === 0) {
    return null;
  }
  const [name, step] = failedEntries[failedEntries.length - 1];
  return { name, error: typeof step?.error === "string" ? step.error : null };
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "n/a";
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

function truncate(value, maxLength) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function sendTelegramMessage({ token, chatId, text }) {
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
          reject(new Error(`Telegram API request failed with status ${statusCode}: ${truncate(body, 500)}`));
        });
      },
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}
