// Stellt einen technischen Fehler aus einer Failure-Datei (collect_dataset/technical-failures/<id>.json)
// lokal nach: genau ein Modifier-Run bzw. genau eine Combat-Episode mit denselben Parametern.
//
//   node scripts/01-data-generation/pipeline/repro-technical-failure.ts <failure.json> [--repeat N]
//
// --repeat fuehrt den Run mehrfach aus, um zu pruefen, ob der Fehler deterministisch wieder auftritt.
// Ergebnis: Konsolentabelle plus data/temp/rl/repro/<failure_id>.result.json.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TechnicalFailure } from "./technical-failures.ts";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../..");
const reproDir = path.join(repoRoot, "data", "temp", "rl", "repro");

type ReproRun = {
  attempt: number;
  status: "technical" | "regular" | "no_output";
  kind: string | null;
  reason: string | null;
  output_path: string;
};

const args = process.argv.slice(2);
const failurePathArg = args.find(arg => !arg.startsWith("--"));
const repeatIndex = args.indexOf("--repeat");
const repeat = repeatIndex >= 0 ? Number.parseInt(args[repeatIndex + 1] ?? "", 10) : 1;

if (!failurePathArg || !Number.isInteger(repeat) || repeat <= 0) {
  console.error("Usage: node scripts/01-data-generation/pipeline/repro-technical-failure.ts <failure.json> [--repeat N]");
  process.exit(2);
}

const failurePath = path.resolve(failurePathArg);
if (!existsSync(failurePath)) {
  console.error(`Failure file not found: ${failurePath}`);
  process.exit(2);
}

const failure = JSON.parse(readFileSync(failurePath, "utf8")) as TechnicalFailure;
mkdirSync(reproDir, { recursive: true });

console.log(`[repro] ${failure.failure_id} (${failure.pipeline}) kind=${failure.kind} reason=${failure.reason}`);
console.log(`[repro] recorded with repo=${failure.commits?.repo ?? "unknown"} submodule=${failure.commits?.submodule ?? "unknown"}`);

const runs: ReproRun[] = [];
for (let attempt = 1; attempt <= repeat; attempt += 1) {
  const run = failure.pipeline === "modifier_strategic_seeded"
    ? reproModifierRun(failure, attempt)
    : reproCombatEpisode(failure, attempt);
  runs.push(run);
  console.log(`[repro] attempt ${attempt}/${repeat}: ${run.status}${run.kind ? ` kind=${run.kind}` : ""}${run.reason ? ` reason=${run.reason}` : ""}`);
}

const reproduced = runs.filter(run => run.status === "technical").length;
const resultPath = path.join(reproDir, `${failure.failure_id}.result.json`);
writeFileSync(resultPath, `${JSON.stringify({
  failure_id: failure.failure_id,
  pipeline: failure.pipeline,
  recorded: { kind: failure.kind, reason: failure.reason, commits: failure.commits },
  repeat,
  reproduced,
  runs,
}, null, 2)}\n`, "utf8");
console.log(`[repro] technical in ${reproduced}/${repeat} attempts; result: ${path.relative(repoRoot, resultPath)}`);

function reproModifierRun(input: TechnicalFailure, attempt: number): ReproRun {
  const params = input.repro.params as Record<string, unknown>;
  const outputPath = path.join(reproDir, `${input.failure_id}--attempt-${attempt}.json`);
  const result = spawnSync("node", [
    "scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts",
    outputPath,
    String(params.seed),
    "1",
    String(params.max_waves),
    String(params.modifier_policy ?? "random_executable"),
    String(params.combat_dqn_checkpoint ?? ""),
    String(params.combat_dqn_device ?? ""),
    "",
    String(params.step_timeout_ms ?? ""),
    String(params.run_process_timeout_ms ?? ""),
    String(params.run_index),
  ], { cwd: repoRoot, stdio: "inherit" });

  if (result.status !== 0 || !existsSync(outputPath)) {
    return { attempt, status: "no_output", kind: null, reason: `runner_exit_${result.status ?? "none"}`, output_path: outputPath };
  }
  const payload = JSON.parse(readFileSync(outputPath, "utf8"));
  const termination = Array.isArray(payload.technical_terminations) ? payload.technical_terminations[0] : null;
  if (termination) {
    return { attempt, status: "technical", kind: termination.kind, reason: termination.reason, output_path: outputPath };
  }
  const episode = payload.episodes?.[0];
  return { attempt, status: "regular", kind: null, reason: episode?.termination_reason ?? null, output_path: outputPath };
}

function reproCombatEpisode(input: TechnicalFailure, attempt: number): ReproRun {
  const params = input.repro.params as { collector_config: Record<string, unknown> };
  const outputPath = path.join(reproDir, `${input.failure_id}--attempt-${attempt}.jsonl`);
  const configPath = path.join(reproDir, `${input.failure_id}--attempt-${attempt}.config.json`);
  const collectorConfig = {
    ...params.collector_config,
    scenario_files: (params.collector_config.scenario_files as string[]).map(file => path.resolve(repoRoot, file)),
    output_path: outputPath,
    append_output: false,
  };
  writeFileSync(configPath, `${JSON.stringify(collectorConfig, null, 2)}\n`, "utf8");

  const result = spawnSync("node", ["scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts", configPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  const summaryPath = `${outputPath}.summary.json`;
  const failuresPath = `${outputPath}.technical-failures.jsonl`;
  if (result.status !== 0 || !existsSync(summaryPath)) {
    return { attempt, status: "no_output", kind: null, reason: `collector_exit_${result.status ?? "none"}`, output_path: outputPath };
  }
  const failures = existsSync(failuresPath)
    ? readFileSync(failuresPath, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  if (failures.length > 0) {
    return { attempt, status: "technical", kind: failures[0].kind, reason: failures[0].reason, output_path: outputPath };
  }
  return { attempt, status: "regular", kind: null, reason: null, output_path: outputPath };
}
