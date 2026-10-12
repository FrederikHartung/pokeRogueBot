// Kampf-Policy ueber eine Claude-Code-Session pro Kampf (persistenter external_command-Worker des Combat-Collectors).
//
// Jeder Kampf (episode_id) bekommt eine eigene `claude -p`-Session im stream-json-Modus. Pro Zug geht eine Nachricht
// mit dem lesbaren Kampfkontext (battle_context) bzw. dem Feature-Zustand hinein, zurueck kommt eine strukturierte
// Antwort {action, reason}. Die Session behaelt den Verlauf des Kampfes wie ein Spieler; zwischen Kaempfen wird sie
// verworfen. Authentifizierung ueber den lokalen Claude-Code-Login, kein API-Key.
//
// Protokoll (eine JSON-Zeile pro Zug, wie dqn_policy_infer_worker.py):
//   stdin:  {"episode_id", "step_index", "battle_context"?, "state", "action_mask"} | {"shutdown": true}
//   stdout: {"action": <int>} | {"error": "<text>"}
//
// Aufruf (aus dem Collector-Policy-Config):
//   node scripts/03-benchmark/eval/claude-session-policy-worker.ts --model haiku --transcript-dir <dir>
//        [--context-mode battle|state] [--turn-timeout-ms 90000]
//
// Muss ausserhalb einer Claude-Code-Session laufen (normales Terminal); Claude Code verweigert verschachtelte Sessions.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

type ContextMode = "battle" | "state";

type Request = {
  episode_id?: string;
  step_index?: number;
  battle_context?: BattleContext;
  state?: Record<string, unknown>;
  action_mask?: number[];
  shutdown?: boolean;
};

type BattleContext = {
  wave?: number | null;
  turn?: number | null;
  battle_type?: string;
  trainer?: string | null;
  enemy_pokemon_remaining?: number | null;
  weather?: string | null;
  terrain?: string | null;
  new_messages?: string[];
  player_party?: PartyMember[];
  enemy_active?: Record<string, unknown> | null;
};

type PartyMember = {
  slot: number;
  species: string;
  level: number;
  hp: number;
  max_hp: number | null;
  status: string | null;
  fainted: boolean;
  active: boolean;
  types: string[];
  ability: string | null;
  stat_stages: Record<string, number>;
  moves: Array<{ slot: number; name: string; type: string; category: string; power: number | null; accuracy: number | null; pp: string }>;
};

type TurnResult = {
  action: number;
  reason: string | null;
  durationMs: number;
  costUsd: number | null;
  usage: Record<string, unknown> | null;
};

const MOVE_ACTIONS = 4;
const MAX_STOP_HOOK_RETRIES = 3;

const args = parseArgs(process.argv.slice(2));
const model = args.get("--model") ?? "haiku";
const contextMode = (args.get("--context-mode") ?? "battle") as ContextMode;
const turnTimeoutMs = Number.parseInt(args.get("--turn-timeout-ms") ?? "", 10) || 90_000;
const transcriptDir = args.get("--transcript-dir") ?? path.join(process.cwd(), "data", "temp", "rl", "claude-policy-transcripts");
// Leeres Arbeitsverzeichnis, damit Claude Code keine Projektanweisungen (CLAUDE.md/AGENTS.md) als Kontext laedt.
const sessionCwd = mkdtempSync(path.join(os.tmpdir(), "claude-policy-"));

if (process.env.CLAUDECODE) {
  console.error("claude-session-policy-worker: CLAUDECODE is set (running inside a Claude Code session). Start the benchmark from a normal terminal.");
  process.exit(2);
}
if (contextMode !== "battle" && contextMode !== "state") {
  console.error(`claude-session-policy-worker: unknown --context-mode ${contextMode}`);
  process.exit(2);
}
mkdirSync(transcriptDir, { recursive: true });

const SYSTEM_PROMPT = [
  "You are playing PokeRogue, a roguelike Pokemon game, as the player. You fight one battle at a time; each user message is one turn of the current battle.",
  "Goal: win the battle (all enemy Pokemon fainted) while keeping your own team as healthy as possible, ideally in few turns. Losing all your Pokemon loses the run.",
  contextMode === "battle"
    ? "Each turn shows what a player sees: your full team with moves and PP, the active enemy (species, level, HP %, types, status, stat changes), weather, and the battle messages since your last decision. You do not know the enemy's moves or remaining team until they are revealed in the battle messages; use what you learned earlier in this battle."
    : "Each turn shows a numeric feature vector describing the battle (bucketed HP, damage estimates, matchups, move and party slot features).",
  "Pick exactly one of the listed legal actions. Actions 0-3 use the move in that move slot of your active Pokemon; actions 4-9 switch to the Pokemon in party slot (action - 4).",
  "Answer only through the structured output: the action number and a one-sentence reason.",
].join("\n");

const ANSWER_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    action: { type: "integer" },
    reason: { type: "string" },
  },
  required: ["action"],
});

class BattleSession {
  readonly episodeId: string;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly transcriptPath: string;
  private pending: { resolve: (result: TurnResult) => void; reject: (error: Error) => void; startedAt: number } | null = null;
  private stopHookRetries = 0;
  private closed = false;
  turns = 0;
  totalCostUsd = 0;

  constructor(episodeId: string) {
    this.episodeId = episodeId;
    this.transcriptPath = path.join(transcriptDir, `${episodeId.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")}.jsonl`);
    this.child = spawn("claude", [
      "-p",
      "--model", model,
      "--tools", "",
      "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--setting-sources", "",
      "--no-session-persistence",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--system-prompt", SYSTEM_PROMPT,
      "--json-schema", ANSWER_SCHEMA,
    ], { cwd: sessionCwd, stdio: ["pipe", "pipe", "pipe"] });

    createInterface({ input: this.child.stdout }).on("line", line => this.onLine(line));
    this.child.stderr.on("data", chunk => process.stderr.write(`[claude ${this.episodeId}] ${String(chunk)}`));
    this.child.on("exit", (code, signal) => {
      this.closed = true;
      this.failPending(`claude session exited (code=${code}, signal=${signal})`);
    });
    this.log({ type: "session_start", model, context_mode: contextMode });
  }

  ask(prompt: string): Promise<TurnResult> {
    if (this.closed) {
      return Promise.reject(new Error("claude session is closed"));
    }
    this.stopHookRetries = 0;
    return new Promise<TurnResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.failPending(`claude turn timed out after ${turnTimeoutMs} ms`);
        this.close();
      }, turnTimeoutMs);
      this.pending = {
        resolve: result => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        },
        startedAt: Date.now(),
      };
      this.log({ type: "user", text: prompt });
      this.child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: prompt } })}\n`);
    });
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.log({ type: "session_end", turns: this.turns, total_cost_usd: this.totalCostUsd });
    this.child.stdin.end();
    setTimeout(() => this.child.kill("SIGTERM"), 2000).unref();
  }

  private onLine(line: string) {
    let event: Record<string, any>;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    // Schleifenschutz: verweigert das Modell das Antwortformat bzw. scheitert der Aufruf (z. B. Login abgelaufen),
    // fordert Claude Code per Stop-Hook immer wieder die strukturierte Antwort an.
    if (event.type === "user" && JSON.stringify(event.message?.content ?? "").includes("StructuredOutput")) {
      this.stopHookRetries += 1;
      if (this.stopHookRetries > MAX_STOP_HOOK_RETRIES) {
        this.failPending("model did not produce a structured answer");
        this.close();
      }
      return;
    }
    if (event.type !== "result" || !this.pending) {
      return;
    }
    const pending = this.pending;
    this.pending = null;
    const costUsd = typeof event.total_cost_usd === "number" ? event.total_cost_usd : null;
    const action = event.structured_output?.action;
    this.log({ type: "result", subtype: event.subtype, is_error: event.is_error, structured_output: event.structured_output ?? null, duration_ms: event.duration_ms, total_cost_usd: costUsd, usage: event.usage ?? null });
    if (event.is_error || !Number.isInteger(action)) {
      pending.reject(new Error(`claude result without action: ${String(event.result ?? event.subtype).slice(0, 300)}`));
      return;
    }
    this.turns += 1;
    // total_cost_usd ist pro Session kumulativ (rechnerischer Wert; ueber den Claude-Plan wird nicht abgerechnet).
    if (costUsd != null) {
      this.totalCostUsd = Math.max(this.totalCostUsd, costUsd);
    }
    pending.resolve({
      action,
      reason: typeof event.structured_output?.reason === "string" ? event.structured_output.reason : null,
      durationMs: Date.now() - pending.startedAt,
      costUsd,
      usage: event.usage ?? null,
    });
  }

  private failPending(reason: string) {
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending.reject(new Error(reason));
    }
  }

  private log(entry: Record<string, unknown>) {
    appendFileSync(this.transcriptPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
  }
}

let session: BattleSession | null = null;

const input = createInterface({ input: process.stdin });
const queue: string[] = [];
let busy = false;

input.on("line", line => {
  queue.push(line);
  void drain();
});
input.on("close", () => {
  session?.close();
});

async function drain() {
  if (busy) {
    return;
  }
  busy = true;
  while (queue.length > 0) {
    const line = queue.shift()!.trim();
    if (line.length === 0) {
      continue;
    }
    let response: Record<string, unknown>;
    try {
      const request = JSON.parse(line) as Request;
      if (request.shutdown === true) {
        session?.close();
        process.exit(0);
      }
      response = { action: await decide(request) };
    } catch (error) {
      response = { error: String((error as Error)?.message ?? error) };
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
  busy = false;
}

async function decide(request: Request): Promise<number> {
  const mask = Array.isArray(request.action_mask) ? request.action_mask : [];
  const legal = mask.flatMap((value, index) => (value === 1 ? [index] : []));
  if (legal.length === 0) {
    throw new Error("no legal action in action_mask");
  }
  const episodeId = request.episode_id ?? "unknown-episode";
  if (session == null || session.episodeId !== episodeId) {
    session?.close();
    session = new BattleSession(episodeId);
  }

  const prompt = contextMode === "battle" && request.battle_context
    ? formatBattleTurn(request.battle_context, legal, request.step_index)
    : formatStateTurn(request.state ?? {}, legal, request.step_index);
  let result = await session.ask(prompt);
  if (!legal.includes(result.action)) {
    result = await session.ask(`Action ${result.action} is not legal this turn. Choose one of: ${legal.join(", ")}.`);
    if (!legal.includes(result.action)) {
      throw new Error(`model chose illegal action ${result.action} twice (legal: ${legal.join(",")})`);
    }
  }
  return result.action;
}

function formatBattleTurn(context: BattleContext, legal: number[], stepIndex: number | undefined): string {
  const party = context.player_party ?? [];
  const active = party.find(member => member.active) ?? null;
  const lines: string[] = [];
  lines.push(`Decision ${Number(stepIndex ?? 0) + 1} | wave ${context.wave ?? "?"} | battle turn ${context.turn ?? "?"} | ${context.battle_type === "trainer" ? `trainer battle vs ${context.trainer ?? "trainer"} (${context.enemy_pokemon_remaining ?? "?"} enemy Pokemon left)` : "wild battle"}`);
  if (context.weather || context.terrain) {
    lines.push(`Field: weather ${context.weather ?? "none"}, terrain ${context.terrain ?? "none"}`);
  }
  if ((context.new_messages ?? []).length > 0) {
    lines.push("Battle messages since your last decision:");
    for (const message of context.new_messages ?? []) {
      lines.push(`  - ${message}`);
    }
  }
  const enemy = context.enemy_active;
  if (enemy) {
    lines.push(`Enemy: ${enemy.species} Lv${enemy.level}, HP ${enemy.hp_percent}%, types ${(enemy.types as string[] ?? []).join("/")}${enemy.status ? `, status ${enemy.status}` : ""}${formatStages(enemy.stat_stages as Record<string, number>)}${enemy.boss ? ", BOSS" : ""}`);
  }
  for (const member of party) {
    const head = `${member.active ? "Active" : `Bench slot ${member.slot}`}: ${member.species} Lv${member.level}, HP ${member.hp}/${member.max_hp ?? "?"}${member.fainted ? " (fainted)" : ""}, types ${member.types.join("/")}${member.status ? `, status ${member.status}` : ""}${member.ability ? `, ability ${member.ability}` : ""}${formatStages(member.stat_stages)}`;
    lines.push(head);
    if (member.active || member === active) {
      for (const move of member.moves) {
        lines.push(`    move ${move.slot}: ${move.name} (${move.type}, ${move.category}${move.power ? `, power ${move.power}` : ""}${move.accuracy ? `, acc ${move.accuracy}` : ""}, PP ${move.pp})`);
      }
    } else {
      lines.push(`    moves: ${member.moves.map(move => move.name).join(", ")}`);
    }
  }
  lines.push(`Legal actions: ${legal.map(action => `${action}=${describeAction(action, party, active)}`).join("; ")}`);
  return lines.join("\n");
}

function describeAction(action: number, party: PartyMember[], active: PartyMember | null): string {
  if (action < MOVE_ACTIONS) {
    return `use ${active?.moves[action]?.name ?? `move ${action}`}`;
  }
  const slot = action - MOVE_ACTIONS;
  return `switch to ${party[slot]?.species ?? `party slot ${slot}`}`;
}

function formatStages(stages: Record<string, number> | undefined): string {
  const entries = Object.entries(stages ?? {});
  return entries.length === 0 ? "" : `, stat stages ${entries.map(([stat, value]) => `${stat}${value > 0 ? "+" : ""}${value}`).join(" ")}`;
}

function formatStateTurn(state: Record<string, unknown>, legal: number[], stepIndex: number | undefined): string {
  return [
    `Decision ${Number(stepIndex ?? 0) + 1}. Battle features:`,
    JSON.stringify(state),
    `Legal actions: ${legal.join(", ")}`,
  ].join("\n");
}

function parseArgs(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]!;
    if (key.startsWith("--") && index + 1 < argv.length) {
      result.set(key, argv[index + 1]!);
      index += 1;
    }
  }
  return result;
}
