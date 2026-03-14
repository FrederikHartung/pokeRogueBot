import https from "node:https";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

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

const stateDir = cli.stateDir ?? path.join(repoRoot, "data", "rl", "pipeline-runs", "wave-library-iterative-remote-control");
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
  const allowedCommands = new Set(["status", "issues", "last", "benchmarks", "help"]);
  if (!allowedCommands.has(command)) {
    await sendMessage({
      token,
      chatId,
      text: ["Unknown command.", "Allowed commands:", "/status", "/benchmarks", "/issues", "/last", "/help"].join("\n"),
    });
    return;
  }

  if (command === "help") {
    await sendMessage({
      token,
      chatId,
      text: ["Available commands:", "/status", "/benchmarks", "/issues", "/last"].join("\n"),
    });
    return;
  }

  const reply = command === "status"
    ? buildCompactStatusReply()
    : command === "benchmarks"
      ? buildBenchmarksReply()
      : runRemoteHelper(command);
  await sendMessage({
    token,
    chatId,
    text: reply,
  });
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
  const result = spawnSync("bash", ["scripts/run-wave-library-bootstrap-remote.sh", command], {
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
  const configPath = loadActiveConfigPath();
  const runtimeDir = runtimeDirForConfig(configPath);
  const manifestPath = path.join(runtimeDir, "manifest.json");
  const runName = path.basename(runtimeDir);

  if (!existsSync(manifestPath)) {
    return [`Run: ${runName}`, "State: not started"].join("\n");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const lines = [`Run: ${runName}`];
  const progress = summarizeProgress(manifest);
  const state = inferPipelineState(manifest);
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

function buildBenchmarksReply() {
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

function loadActiveConfigPath() {
  if (existsSync(activeConfigPathFile)) {
    return readFileSync(activeConfigPathFile, "utf8").trim();
  }
  return defaultConfigPath;
}

function runtimeDirForConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);
  const dataRlDir = path.join(repoRoot, "data", "rl");
  const config = JSON.parse(readFileSync(absoluteConfigPath, "utf8"));
  const value = config.output_root ?? "./pipeline-runs/wave-library-iterative";
  return resolvePathWithFallbacks(value, [configDir, dataRlDir, repoRoot]);
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
