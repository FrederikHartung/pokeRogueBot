// Prueft per Telegram `getMe`, ob Bot-Token und Netzwerk funktionieren.
// Sendet keine Nachricht und konkurriert nicht mit einem laufenden Control-Bot um `getUpdates`.
import https from "node:https";

type GetMeResponse = {
  ok: boolean;
  description?: string;
  result?: { username?: string };
};

const token = process.env.POKEROGUE_TELEGRAM_BOT_TOKEN ?? "";
const chatId = process.env.POKEROGUE_TELEGRAM_CHAT_ID ?? "";
const timeoutMs = 15000;

if (!token || !chatId) {
  console.error("Missing POKEROGUE_TELEGRAM_BOT_TOKEN or POKEROGUE_TELEGRAM_CHAT_ID");
  process.exit(1);
}

try {
  const response = await getMe(token);
  if (!response.ok) {
    console.error(`Telegram getMe failed: ${response.description ?? "unknown error"}`);
    process.exit(1);
  }
  console.log(`Telegram bot reachable: @${response.result?.username ?? "unknown"}`);
} catch (error) {
  console.error(`Telegram getMe failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function getMe(botToken: string): Promise<GetMeResponse> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      { hostname: "api.telegram.org", path: `/bot${botToken}/getMe`, method: "GET" },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(body) as GetMeResponse);
          } catch {
            reject(new Error(`Unexpected response (HTTP ${response.statusCode})`));
          }
        });
      },
    );
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    request.on("error", reject);
    request.end();
  });
}
