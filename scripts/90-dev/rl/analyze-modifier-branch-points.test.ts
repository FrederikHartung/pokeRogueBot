import assert from "node:assert/strict";
import test from "node:test";

import { analyzeBranchPoints, summarizeFamilies } from "./analyze-modifier-branch-points.ts";

const CANDIDATES = [
  { kind: "take_reward", item_id: "BERRY", item_family: "berry" },
  { kind: "take_reward", item_id: "POKEBALL", item_family: "ball" },
];

function row(runIndex: number, stepIndex: number, selected: number, waveReached: number, state: unknown = { wave: stepIndex }) {
  return {
    seed: "s1",
    run_index: runIndex,
    step_index: stepIndex,
    wave_index: stepIndex + 1,
    decision_stage: "reward",
    selected_candidate_index: selected,
    wave_reached: waveReached,
    state,
    candidates: CANDIDATES,
  };
}

test("finds the first differing decision and scores branches against the node mean", () => {
  // Runs 0 und 1 waehlen in Step 0 Beere, Run 2 Ball; danach trennen sich 0 und 1 in Step 1.
  const rows = [
    row(0, 0, 0, 12), row(0, 1, 0, 12),
    row(1, 0, 0, 8), row(1, 1, 1, 8),
    row(2, 0, 1, 6), row(2, 1, 0, 6),
  ];
  const analysis = analyzeBranchPoints(rows);
  assert.equal(analysis.stateDivergences, 0);
  assert.equal(analysis.branchPoints.length, 2);

  const first = analysis.branchPoints.find(point => point.step_index === 0)!;
  const berry = first.branches.find(branch => branch.family === "reward:berry")!;
  const ball = first.branches.find(branch => branch.family === "reward:ball")!;
  assert.equal(berry.mean_wave, 10);
  assert.equal(ball.mean_wave, 6);
  assert.equal(berry.advantage, 2);
  assert.equal(ball.advantage, -2);

  const second = analysis.branchPoints.find(point => point.step_index === 1)!;
  assert.equal(second.run_count, 2);

  const families = summarizeFamilies(analysis.branchPoints);
  assert.equal(families.find(family => family.family === "reward:ball")!.branches, 2);
});

test("counts a different state after identical decisions as a divergence, not a branch", () => {
  const rows = [
    row(0, 0, 0, 10), row(0, 1, 0, 10, { wave: 1, money: 100 }),
    row(1, 0, 0, 7), row(1, 1, 1, 7, { wave: 1, money: 200 }),
  ];
  const analysis = analyzeBranchPoints(rows);
  assert.equal(analysis.stateDivergences, 1);
  assert.equal(analysis.branchPoints.length, 0);
});
