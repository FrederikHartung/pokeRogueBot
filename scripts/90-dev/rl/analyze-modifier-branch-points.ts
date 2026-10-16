import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// Gabelungs-Analyse der Strategic-Trainingsdaten (`modifier_training_transition_v4`).
//
// Das Spiel ist pro Seed und Welle deterministisch: Runs desselben Seeds sind identisch, bis sich eine
// Modifier-Entscheidung unterscheidet. Pro Seed entsteht so ein Entscheidungsbaum. An jedem Knoten mit mehreren
// gewaehlten Kandidaten ("Gabelung") ist der State fuer alle Runs gleich; die Runs der Zweige unterscheiden sich
// erst ab hier. Der Vorteil einer Wahl ist das mittlere Ergebnis ihres Zweigs minus das Mittel ueber alle Zweige
// des Knotens (jeder Zweig gleich gewichtet). Spaetere Entscheidungen verrauschen das, aber ohne den
// Unterschied zwischen verschiedenen States.
//
// Die Analyse prueft auch, ob die Annahme haelt: Unterscheidet sich der State zweier Runs, obwohl alle
// Entscheidungen davor gleich waren, wird das als `state_divergence` gezaehlt.
//
// Aufruf:
//   node scripts/90-dev/rl/analyze-modifier-branch-points.ts --input <transitions.jsonl> [--input ...] [--out <report.json>]

interface Candidate {
  kind: string;
  item_id?: string | null;
  item_family?: string | null;
  target_party_index?: number | null;
  target_move_index?: number | null;
}

interface TransitionRow {
  seed: string;
  run_index: number;
  step_index: number;
  wave_index: number;
  decision_stage: string;
  selected_candidate_index: number;
  wave_reached: number;
  state: unknown;
  candidates: Candidate[];
}

interface RunSteps {
  runIndex: number;
  waveReached: number;
  steps: TransitionRow[];
}

interface Branch {
  label: string;
  family: string;
  runs: RunSteps[];
  meanWave: number;
}

interface BranchPoint {
  seed: string;
  step_index: number;
  wave_index: number;
  decision_stage: string;
  run_count: number;
  branches: Array<{ label: string; family: string; runs: number; mean_wave: number; advantage: number }>;
}

interface Options {
  inputs: string[];
  out: string | null;
}

function parseArgs(argv: string[]): Options {
  const inputs: string[] = [];
  let out: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--input" && next) {
      inputs.push(next);
      index += 1;
    } else if (arg === "--out" && next) {
      out = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (inputs.length === 0) {
    throw new Error("At least one --input <transitions.jsonl> is required");
  }
  return { inputs, out };
}

function readRows(paths: string[]): TransitionRow[] {
  return paths.flatMap(file =>
    readFileSync(file, "utf8")
      .split("\n")
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as TransitionRow),
  );
}

function hashDecisionContext(row: TransitionRow): string {
  return createHash("sha1")
    .update(JSON.stringify([row.decision_stage, row.state, row.candidates]))
    .digest("hex");
}

/** Wahl als vergleichbarer Schluessel: Art, Item und Ziel (Kandidaten-Indizes koennen sich verschieben). */
export function choiceLabel(row: TransitionRow): string {
  const candidate = row.candidates[row.selected_candidate_index];
  if (!candidate) {
    throw new Error(`Missing selected candidate in ${row.seed}#${row.run_index} step ${row.step_index}`);
  }
  return [
    candidate.kind,
    candidate.item_id ?? "",
    candidate.target_party_index ?? "",
    candidate.target_move_index ?? "",
  ].join("|");
}

export function choiceFamily(row: TransitionRow): string {
  const candidate = row.candidates[row.selected_candidate_index]!;
  return `${row.decision_stage}:${candidate.item_family ?? candidate.kind}`;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export interface BranchAnalysis {
  branchPoints: BranchPoint[];
  stateDivergences: number;
  seeds: number;
  runs: number;
}

/** Baut pro Seed den Entscheidungsbaum und sammelt alle Gabelungen. */
export function analyzeBranchPoints(rows: TransitionRow[]): BranchAnalysis {
  const bySeed = new Map<string, Map<number, TransitionRow[]>>();
  for (const row of rows) {
    const runs = bySeed.get(row.seed) ?? new Map<number, TransitionRow[]>();
    const steps = runs.get(row.run_index) ?? [];
    steps.push(row);
    runs.set(row.run_index, steps);
    bySeed.set(row.seed, runs);
  }

  const branchPoints: BranchPoint[] = [];
  let stateDivergences = 0;
  let runCount = 0;

  for (const [seed, runMap] of bySeed) {
    const runs: RunSteps[] = [...runMap.entries()].map(([runIndex, steps]) => {
      steps.sort((a, b) => a.step_index - b.step_index);
      return { runIndex, waveReached: steps[0]!.wave_reached, steps };
    });
    runCount += runs.length;

    // Rekursiv: alle Runs einer Gruppe hatten bis `depth` dieselben Entscheidungen.
    const visit = (group: RunSteps[], depth: number): void => {
      const active = group.filter(run => run.steps.length > depth);
      if (active.length < 2) {
        return;
      }
      const contexts = new Map<string, RunSteps[]>();
      for (const run of active) {
        const key = hashDecisionContext(run.steps[depth]!);
        contexts.set(key, [...(contexts.get(key) ?? []), run]);
      }
      if (contexts.size > 1) {
        // Gleiche Vorgeschichte, aber anderer State: Determinismus verletzt (z. B. Kampf-Inferenz). Jede
        // Teilgruppe wird fuer sich weiter untersucht, die Stelle selbst ist keine Gabelung.
        stateDivergences += 1;
        for (const subgroup of contexts.values()) {
          visit(subgroup, depth);
        }
        return;
      }

      const byChoice = new Map<string, RunSteps[]>();
      for (const run of active) {
        const label = choiceLabel(run.steps[depth]!);
        byChoice.set(label, [...(byChoice.get(label) ?? []), run]);
      }
      if (byChoice.size > 1) {
        const reference = active[0]!.steps[depth]!;
        const branches: Branch[] = [...byChoice.entries()].map(([label, branchRuns]) => ({
          label,
          family: choiceFamily(branchRuns[0]!.steps[depth]!),
          runs: branchRuns,
          meanWave: mean(branchRuns.map(run => run.waveReached)),
        }));
        const nodeMean = mean(branches.map(branch => branch.meanWave));
        branchPoints.push({
          seed,
          step_index: depth,
          wave_index: reference.wave_index,
          decision_stage: reference.decision_stage,
          run_count: active.length,
          branches: branches.map(branch => ({
            label: branch.label,
            family: branch.family,
            runs: branch.runs.length,
            mean_wave: branch.meanWave,
            advantage: branch.meanWave - nodeMean,
          })),
        });
      }
      for (const branchRuns of byChoice.values()) {
        visit(branchRuns, depth + 1);
      }
    };
    visit(runs, 0);
  }

  return { branchPoints, stateDivergences, seeds: bySeed.size, runs: runCount };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrapCi(values: number[], iterations = 4000): [number, number] {
  if (values.length < 2) {
    return [Number.NaN, Number.NaN];
  }
  const random = mulberry32(1);
  const means: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      sum += values[Math.floor(random() * values.length)]!;
    }
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(iterations * 0.025)]!, means[Math.floor(iterations * 0.975)]!];
}

export interface FamilyAdvantage {
  family: string;
  branches: number;
  runs: number;
  mean_advantage: number;
  ci95: [number, number];
}

/** Mittlerer Vorteil je Item-Familie ueber alle Gabelungen (ein Wert pro Zweig). */
export function summarizeFamilies(branchPoints: BranchPoint[]): FamilyAdvantage[] {
  const byFamily = new Map<string, { advantages: number[]; runs: number }>();
  for (const point of branchPoints) {
    for (const branch of point.branches) {
      const entry = byFamily.get(branch.family) ?? { advantages: [], runs: 0 };
      entry.advantages.push(branch.advantage);
      entry.runs += branch.runs;
      byFamily.set(branch.family, entry);
    }
  }
  return [...byFamily.entries()]
    .map(([family, entry]) => ({
      family,
      branches: entry.advantages.length,
      runs: entry.runs,
      mean_advantage: mean(entry.advantages),
      ci95: bootstrapCi(entry.advantages),
    }))
    .sort((a, b) => b.branches - a.branches);
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "-";
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const analysis = analyzeBranchPoints(readRows(options.inputs));
  const families = summarizeFamilies(analysis.branchPoints);
  const byWave = new Map<number, number>();
  for (const point of analysis.branchPoints) {
    byWave.set(point.wave_index, (byWave.get(point.wave_index) ?? 0) + 1);
  }

  console.log(`Seeds ${analysis.seeds}, Runs ${analysis.runs}, Gabelungen ${analysis.branchPoints.length}, State-Abweichungen ohne andere Entscheidung ${analysis.stateDivergences}`);
  console.log(`Gabelungen nach Welle: ${[...byWave.entries()].sort((a, b) => a[0] - b[0]).map(([wave, count]) => `${wave}:${count}`).join(" ")}`);
  console.log("");
  console.log("| Wahl (Stufe:Familie) | Zweige | Runs | Vorteil (Wellen) | 95-%-KI |");
  console.log("|---|---:|---:|---:|---|");
  for (const family of families) {
    console.log(`| ${family.family} | ${family.branches} | ${family.runs} | ${formatNumber(family.mean_advantage)} | [${formatNumber(family.ci95[0])}, ${formatNumber(family.ci95[1])}] |`);
  }

  if (options.out) {
    writeFileSync(options.out, `${JSON.stringify({ ...analysis, families }, null, 2)}\n`, "utf8");
    console.log(`\nReport: ${options.out}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
