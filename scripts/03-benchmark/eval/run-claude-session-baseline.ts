// Spielt die Benchmark-Kaempfe einmal mit der Claude-Session-Policy (eine `claude -p`-Session pro Kampf) und legt das
// Ergebnis als wiederverwendbare Baseline ab. eval_policy_compare.py liest sie danach per --extra-baseline ein, ohne die
// Kaempfe erneut zu spielen.
//
//   node scripts/03-benchmark/eval/run-claude-session-baseline.ts --model haiku [--label claude-haiku]
//        [--collector-config data/rl/collector-run-benchmarked-wave-library-v3-full.json]
//        [--parallelism 3] [--limit 26] [--context-mode battle|state]
//
// Ausgabe: data/rl/benchmark-baselines/<label>.jsonl (Transitions wie bei den anderen Policies, nicht versioniert),
//          <label>.meta.json (Modell, Prompt-Modus, Commits, Verbrauch, technische Fehler; versioniert),
//          <label>/ (Teil-Laeufe, Session-Transkripte mit Begruendung pro Zug).
// Laeuft lokal mit dem Claude-Code-Login, ausserhalb einer Claude-Code-Session (normales Terminal).
// --limit waehlt fuer Smoke-Laeufe gleichmaessig ueber die Waves verteilte Szenarien.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readGitCommits } from "../../01-data-generation/pipeline/technical-failures.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = parseArgs(process.argv.slice(2));
const model = args.get("--model") ?? "haiku";
const label = args.get("--label") ?? `claude-${model}`;
const contextMode = args.get("--context-mode") ?? "battle";
const parallelism = Math.max(1, Number.parseInt(args.get("--parallelism") ?? "3", 10));
const limit = Number.parseInt(args.get("--limit") ?? "", 10) || null;
const collectorConfigPath = path.resolve(repoRoot, args.get("--collector-config") ?? "data/rl/collector-run-benchmarked-wave-library-v3-full.json");
const baselineDir = path.join(repoRoot, "data", "rl", "benchmark-baselines");
const runDir = path.join(baselineDir, label);
const outputPath = path.join(baselineDir, `${label}.jsonl`);
const metaPath = path.join(baselineDir, `${label}.meta.json`);
// Prompt-Version hochzaehlen, wenn sich System-Prompt oder Zugformat im Worker aendern.
const PROMPT_VERSION = "battle-session-v2"; // v2: Zwangswechsel und Wechselangebot (combat-v4)

if (process.env.CLAUDECODE) {
  console.error("Run this from a normal terminal: Claude Code refuses nested sessions (CLAUDECODE is set).");
  process.exit(2);
}

const baseConfig = JSON.parse(readFileSync(collectorConfigPath, "utf8")) as Record<string, unknown>;
const scenarioFiles = selectScenarios(resolveScenarioFiles(baseConfig), limit);
if (scenarioFiles.length === 0) {
  throw new Error(`No scenarios resolved from ${collectorConfigPath}`);
}

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });
const startedAt = new Date();
console.log(`[claude-baseline] ${label}: ${scenarioFiles.length} battles, model=${model}, context=${contextMode}, parallelism=${parallelism}`);

const chunks = Array.from({ length: Math.min(parallelism, scenarioFiles.length) }, (_, index) =>
  scenarioFiles.filter((_, fileIndex) => fileIndex % parallelism === index));
const chunkResults = await Promise.all(chunks.map((files, index) => runChunk(files, index)));

// Transitions zusammenfuehren (Reihenfolge der Teil-Laeufe), technische Fehler und Zusammenfassungen sammeln.
const lines: string[] = [];
const technicalFailures: unknown[] = [];
let regularEpisodes = 0;
for (const chunk of chunkResults) {
  if (existsSync(chunk.outputPath)) {
    lines.push(...readFileSync(chunk.outputPath, "utf8").split("\n").filter(Boolean));
  }
  const failuresPath = `${chunk.outputPath}.technical-failures.jsonl`;
  if (existsSync(failuresPath)) {
    technicalFailures.push(...readFileSync(failuresPath, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)));
  }
  const summaryPath = `${chunk.outputPath}.summary.json`;
  if (existsSync(summaryPath)) {
    regularEpisodes += Number(JSON.parse(readFileSync(summaryPath, "utf8")).regular_episodes ?? 0);
  }
}
writeFileSync(outputPath, lines.length > 0 ? `${lines.join("\n")}\n` : "", "utf8");

const usage = summarizeTranscripts(path.join(runDir, "transcripts"));
const meta = {
  label,
  model,
  context_mode: contextMode,
  prompt_version: PROMPT_VERSION,
  collector_config: path.relative(repoRoot, collectorConfigPath),
  battles_planned: scenarioFiles.length,
  battles_regular: regularEpisodes,
  technical_failures: technicalFailures.length,
  transitions: lines.length,
  decisions: usage.decisions,
  notional_cost_usd: usage.costUsd,
  avg_decision_ms: usage.decisions > 0 ? Math.round(usage.durationMs / usage.decisions) : null,
  commits: readGitCommits(repoRoot),
  started_at: startedAt.toISOString(),
  completed_at: new Date().toISOString(),
  runtime_ms: Date.now() - startedAt.getTime(),
};
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
console.log(`[claude-baseline] done: ${JSON.stringify(meta)}`);
console.log(`[claude-baseline] baseline: ${path.relative(repoRoot, outputPath)} (use with eval_policy_compare.py --extra-baseline ${label}=${path.relative(repoRoot, outputPath)})`);

async function runChunk(files: string[], index: number) {
  const chunkOutputPath = path.join(runDir, `chunk-${index}.jsonl`);
  const chunkConfigPath = path.join(runDir, `chunk-${index}.config.json`);
  const config = {
    ...baseConfig,
    scenario_dir: undefined,
    scenario_files: files,
    output_path: chunkOutputPath,
    append_output: false,
    // Grob 30 s pro Kampf plus Puffer; ein Kampf mit Claude dauert deutlich laenger als mit DQN.
    test_timeout_ms: Math.max(1_800_000, files.length * 120_000),
    policy: {
      type: "external_command",
      command: [
        "node",
        path.join(repoRoot, "scripts", "03-benchmark", "eval", "claude-session-policy-worker.ts"),
        "--model", model,
        "--context-mode", contextMode,
        "--transcript-dir", path.join(runDir, "transcripts"),
      ],
      persistent: true,
      // Worker-Zeitlimit pro Zug (90 s) plus ein Korrekturversuch bei illegaler Aktion.
      timeout_ms: 200_000,
      include_battle_context: contextMode === "battle",
    },
  };
  writeFileSync(chunkConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const logPath = path.join(runDir, `chunk-${index}.log`);
  console.log(`[claude-baseline] chunk ${index}: ${files.length} battles, log ${path.relative(repoRoot, logPath)}`);
  const exitCode = await new Promise<number>(resolve => {
    const child = spawn("node", ["scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts", chunkConfigPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const log: string[] = [];
    const onData = (chunk: Buffer) => {
      const text = String(chunk);
      log.push(text);
      for (const line of text.split("\n")) {
        if (line.includes("[collector-progress]")) {
          console.log(`[claude-baseline] chunk ${index} ${line.trim()}`);
        }
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", code => {
      writeFileSync(logPath, log.join(""), "utf8");
      resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) {
    console.error(`[claude-baseline] chunk ${index} exited with ${exitCode}, see ${logPath}`);
  }
  return { outputPath: chunkOutputPath, exitCode };
}

function resolveScenarioFiles(config: Record<string, unknown>): string[] {
  const configDir = path.dirname(collectorConfigPath);
  if (Array.isArray(config.scenario_files) && config.scenario_files.length > 0) {
    return (config.scenario_files as string[]).map(file => path.resolve(configDir, file));
  }
  const scenarioDir = path.resolve(configDir, String(config.scenario_dir ?? "./scenarios"));
  return readdirSync(scenarioDir).filter(name => name.endsWith(".json")).sort().map(name => path.join(scenarioDir, name));
}

function selectScenarios(files: string[], maxCount: number | null): string[] {
  if (maxCount == null || files.length <= maxCount) {
    return files;
  }
  // Gleichmaessig ueber die Waves verteilen: erst je ein Szenario pro Wave, dann auffuellen.
  const byWave = new Map<number, string[]>();
  for (const file of files) {
    const wave = Number(JSON.parse(readFileSync(file, "utf8")).wave_index ?? 0);
    byWave.set(wave, [...(byWave.get(wave) ?? []), file]);
  }
  const selected: string[] = [];
  for (let round = 0; selected.length < maxCount; round += 1) {
    let added = false;
    for (const wave of [...byWave.keys()].sort((left, right) => left - right)) {
      const candidate = byWave.get(wave)![round];
      if (candidate && selected.length < maxCount) {
        selected.push(candidate);
        added = true;
      }
    }
    if (!added) {
      break;
    }
  }
  return selected;
}

function summarizeTranscripts(dir: string) {
  let decisions = 0;
  let costUsd = 0;
  let durationMs = 0;
  if (!existsSync(dir)) {
    return { decisions, costUsd, durationMs };
  }
  for (const name of readdirSync(dir)) {
    // total_cost_usd ist pro Session kumulativ; die letzte Session eines Teil-Laufs schreibt kein session_end,
    // wenn der Collector den Worker beendet. Daher das Maximum der result-Eintraege pro Kampf.
    let sessionCostUsd = 0;
    for (const line of readFileSync(path.join(dir, name), "utf8").split("\n").filter(Boolean)) {
      const entry = JSON.parse(line);
      if (entry.type === "result" && !entry.is_error) {
        decisions += 1;
        durationMs += Number(entry.duration_ms ?? 0);
        sessionCostUsd = Math.max(sessionCostUsd, Number(entry.total_cost_usd ?? 0));
      }
    }
    costUsd += sessionCostUsd;
  }
  return { decisions, costUsd, durationMs };
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
