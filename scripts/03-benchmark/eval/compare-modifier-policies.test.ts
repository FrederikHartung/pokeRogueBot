import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bootstrapMeanCi,
  comparePaired,
  type EpisodeSummary,
  type PolicyData,
  renderTelegramText,
  seedMeans,
  summarizePolicy,
} from "./compare-modifier-policies.ts";

function episode(seed: string, runIndex: number, waveReached: number, extra: Partial<EpisodeSummary> = {}): EpisodeSummary {
  return {
    seed,
    run_index: runIndex,
    wave_reached: waveReached,
    final_money: 100,
    reward_picks: 4,
    wasted_picks: 1,
    fixed_battle_entries: [],
    ...extra,
  };
}

function policy(label: string, episodes: EpisodeSummary[], maxWaves = 50): PolicyData {
  return {
    label,
    runtime_dir: `/tmp/${label}`,
    modifier_policy: label,
    combat_dqn_checkpoint: "model.pt",
    max_waves: maxWaves,
    episodes,
    technical_terminations: 0,
  };
}

test("seedMeans averages repeated runs of a seed", () => {
  const means = seedMeans([episode("a", 0, 7), episode("a", 1, 9), episode("b", 0, 12)]);
  assert.equal(means.get("a"), 8);
  assert.equal(means.get("b"), 12);
});

test("summarizePolicy counts fixed battle survival from completed waves", () => {
  const summary = summarizePolicy(
    policy("random", [
      episode("a", 0, 7, { fixed_battle_entries: [{ wave_index: 8, party_hp_ratio_sum: 2, alive_count: 3 }] }),
      episode("b", 0, 9, { fixed_battle_entries: [{ wave_index: 8, party_hp_ratio_sum: 3, alive_count: 3 }] }),
      episode("c", 0, 5),
    ]),
  );
  const rival1 = summary.fixed_battles.find(entry => entry.wave === 8)!;
  // Run a stirbt im Rivalenkampf (7 abgeschlossen), b ueberlebt ihn, c erreicht ihn nicht.
  assert.equal(rival1.reached, 2);
  assert.equal(rival1.survived, 1);
  assert.equal(rival1.survival_rate, 0.5);
  assert.equal(rival1.mean_entry_hp, 2.5);
  assert.equal(summary.wasted_pick_share, 0.25);
  assert.equal(summary.median_wave, 7);
});

test("comparePaired pairs seeds and calls a consistent improvement better", () => {
  const seeds = Array.from({ length: 30 }, (_, index) => `s${index}`);
  const baseline = policy("random", seeds.flatMap(seed => [episode(seed, 0, 8), episode(seed, 1, 10)]));
  const candidate = policy("heuristic_v1", seeds.map((seed, index) => episode(seed, 0, index % 3 === 0 ? 11 : 12)));
  const comparison = comparePaired(baseline, candidate);
  assert.equal(comparison.paired_seeds, 30);
  // Baseline pro Seed 9 (Mittel aus 8 und 10), Kandidat 11 bzw. 12: Differenz 2 bei 10 Seeds, 3 bei 20.
  assert.ok(Math.abs(comparison.mean_diff - 8 / 3) < 1e-12);
  assert.equal(comparison.verdict, "candidate_better");
  assert.equal(comparison.wins, 30);
});

test("comparePaired reports no clear difference for noise around zero", () => {
  const seeds = Array.from({ length: 20 }, (_, index) => `s${index}`);
  const baseline = policy("random", seeds.map(seed => episode(seed, 0, 10)));
  const candidate = policy("heuristic_v1", seeds.map((seed, index) => episode(seed, 0, index % 2 === 0 ? 13 : 7)));
  const comparison = comparePaired(baseline, candidate);
  assert.equal(comparison.mean_diff, 0);
  assert.equal(comparison.verdict, "no_clear_difference");
  assert.equal(comparison.wins + comparison.losses, 20);
});

test("bootstrapMeanCi is deterministic and contains the mean", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const first = bootstrapMeanCi(values);
  assert.deepEqual(bootstrapMeanCi(values), first);
  assert.ok(first[0] < 3.5 && first[1] > 3.5);
});

test("renderTelegramText names the verdict", () => {
  const seeds = ["s1", "s2"];
  const baseline = policy("random", seeds.map(seed => episode(seed, 0, 8)));
  const candidate = policy("heuristic_v1", seeds.map(seed => episode(seed, 0, 8)));
  const text = renderTelegramText([summarizePolicy(baseline), summarizePolicy(candidate)], [comparePaired(baseline, candidate)]);
  assert.match(text, /heuristic_v1 vs random: \+0\.00 Wellen pro Seed/);
  assert.match(text, /Urteil: kein klarer Unterschied/);
});
