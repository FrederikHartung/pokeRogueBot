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
  artifactsSummaryPath: cli.artifactsSummaryPath,
  benchmarkSummaryPath: cli.benchmarkSummaryPath,
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
    artifactsSummaryPath: null,
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
    if (arg === "--artifacts-summary") {
      state.artifactsSummaryPath = resolveOptionalPath(args[index + 1] ?? null);
      index += 1;
      continue;
    }
    if (arg === "--benchmark-summary") {
      state.benchmarkSummaryPath = resolveOptionalPath(args[index + 1] ?? null);
      index += 1;
      continue;
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
  if (typeof value !== "string") {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function loadOptionalJson(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function buildMessage({
  event,
  runtimeDir,
  manifestPath,
  artifactsSummaryPath,
  benchmarkSummaryPath,
  phase,
  iteration,
  error,
  manifest,
  benchmarkSummary,
}) {
  const lines = [];
  lines.push(titleForEvent(event));
  lines.push(`Run: ${runtimeDir ? path.basename(runtimeDir) : "unknown-run"}`);

  if (iteration != null) {
    lines.push(`Iteration: ${iteration}`);
  }
  if (phase) {
    lines.push(`Phase: ${phase}`);
  }

  const progress = summarizeProgress(manifest);
  if (progress) {
    lines.push(`Batches: ${progress.completedBatches}/${progress.totalBatches}`);
    lines.push(`Episodes: ${progress.completedEpisodes}/${progress.totalEpisodes}`);
  }

  const latestBenchmark = summarizeLatestBenchmark(iteration, benchmarkSummary);
  if (latestBenchmark) {
    lines.push(
      `DQN: win_rate=${formatNumber(latestBenchmark.win_rate)} avg_reward=${formatNumber(latestBenchmark.avg_reward)} avg_turns=${formatNumber(latestBenchmark.avg_turns)}`,
    );
  }

  if (error) {
    lines.push(`Error: ${truncate(error, 500)}`);
  }
  if (manifestPath) {
    lines.push(`Manifest: ${manifestPath}`);
  }
  if (artifactsSummaryPath && (event === "pipeline_completed" || event === "iteration_completed")) {
    lines.push(`Artifacts: ${artifactsSummaryPath}`);
  }
  if (benchmarkSummaryPath && event === "iteration_completed") {
    lines.push(`Benchmark summary: ${benchmarkSummaryPath}`);
  }

  const host = process.env.HOSTNAME || process.env.HOST || null;
  if (host) {
    lines.push(`Host: ${host}`);
  }

  return lines.join("\n");
}

function titleForEvent(event) {
  switch (event) {
    case "iteration_completed":
      return "Pipeline update: iteration completed";
    case "pipeline_failed":
      return "Pipeline alert: failed";
    case "pipeline_completed":
      return "Pipeline update: completed";
    case "test":
      return "Pipeline notification test";
    default:
      return `Pipeline event: ${event}`;
  }
}

function summarizeProgress(manifest) {
  if (!manifest || !Array.isArray(manifest.batches)) {
    return null;
  }
  const totalBatches = manifest.batches.length;
  const completedBatches = manifest.batches.filter(batch => batch.status === "completed").length;
  const totalEpisodes = manifest.batches.reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0);
  const completedEpisodes = manifest.batches
    .filter(batch => batch.status === "completed")
    .reduce((sum, batch) => sum + Number(batch.episodes ?? 0), 0);
  return {
    totalBatches,
    completedBatches,
    totalEpisodes,
    completedEpisodes,
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

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "n/a";
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
