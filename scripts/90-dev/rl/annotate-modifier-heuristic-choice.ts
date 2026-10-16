import { readFileSync, writeFileSync } from "node:fs";

import type { ModifierObservation } from "../../../src/main/ts/lib/modifier-observation.ts";
import { pickHeuristicV1CandidateIndex } from "../../../src/main/ts/lib/modifier-heuristic-policy.ts";

// Ergaenzt Trainings-Transitions (`modifier_training_transition_v4`) um `heuristic_candidate_index`: die Wahl von
// `heuristic_v1` in genau dieser Observation, auch fuer die Zufallsentscheidungen von `heuristic_mix_v1`. Ziel fuer
// das Imitationsmodell (BC) der Versuchsreihe in docs/modifier-learning-findings.md.
//
// Aufruf: node scripts/90-dev/rl/annotate-modifier-heuristic-choice.ts <input.jsonl> <output.jsonl>

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: annotate-modifier-heuristic-choice.ts <input.jsonl> <output.jsonl>");
}

let total = 0;
let agreeing = 0;
const lines = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter(line => line.trim().length > 0)
  .map(line => {
    const row = JSON.parse(line) as ModifierObservation & { selected_candidate_index: number };
    const heuristicIndex = pickHeuristicV1CandidateIndex(row);
    if (row.candidates[heuristicIndex]?.mask !== 1) {
      throw new Error(`heuristic_v1 picked a masked candidate (${heuristicIndex})`);
    }
    total += 1;
    agreeing += heuristicIndex === row.selected_candidate_index ? 1 : 0;
    return JSON.stringify({ ...row, heuristic_candidate_index: heuristicIndex });
  });

writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`${total} rows, logged choice = heuristic_v1 in ${agreeing} (${((agreeing / total) * 100).toFixed(1)} %) -> ${outputPath}`);
