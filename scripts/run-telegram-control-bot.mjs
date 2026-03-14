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
  const allowedCommands = new Set(["status", "issues", "last", "help"]);
  if (!allowedCommands.has(command)) {
    await sendMessage({
      token,
      chatId,
      text: [
        "Unknown command.",
        "Allowed commands:",
        "/status",
        "/issues",
        "/last",
        "/help",
      ].join("\n"),
    });
    return;
  }

  if (command === "help") {
    await sendMessage({
      token,
      chatId,
      text: [
        "Available commands:",
        "/status",
        "/issues",
        "/last",
      ].join("\n"),
    });
    return;
  }

  const output = runRemoteHelper(command);
  await sendMessage({
    token,
    chatId,
    text: formatReply(command, output),
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

function formatReply(command, output) {
  return [`Command: ${command}`, "", output].join("\n");
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
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
