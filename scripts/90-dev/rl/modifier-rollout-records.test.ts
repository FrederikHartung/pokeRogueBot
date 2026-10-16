import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModifierCandidate, ModifierObservation, PartySlot } from "../../../src/main/ts/lib/modifier-observation.ts";
import { candidateLabel, type RolloutJob } from "../../../src/main/ts/lib/modifier-rollout.ts";
import {
  buildRolloutRecords,
  type JobResult,
  summarizeRolloutRecords,
  validateRolloutRecord,
} from "../../01-data-generation/pipeline/modifier-rollout-records.ts";

function slot(level: number): PartySlot {
  return {
    present: 1,
    fainted: 0,
    hp_ratio: 1,
    level,
    level_ratio_to_cap: 0.5,
    status: 0,
    types: [0],
    base_stat_total: 300,
    move_count: 3,
    min_pp_ratio: 1,
    held_items: [],
  };
}

function rewardStep(stepIndex: number, wave: number, level: number) {
  const candidates: ModifierCandidate[] = [
    { kind: "take_reward", mask: 1, reward_index: 0, item_id: "RARE_CANDY", item_family: "level_up", tier: 0, cost: 0, target_party_index: 0 },
    { kind: "take_reward", mask: 1, reward_index: 1, item_id: "POKEBALL", item_family: "ball", tier: 0, cost: 0 },
    { kind: "take_reward", mask: 1, reward_index: 2, item_id: "X_ATTACK", item_family: "temp_battle_booster", tier: 0, cost: 0 },
  ];
  const observation: ModifierObservation = {
    schema_version: "modifier-v1",
    decision_stage: "reward",
    state: {
      run: {
        wave_index: wave,
        money: 100,
        reroll_cost: 250,
        reroll_count: 0,
        lock_rarities: 0,
        shop_available: 0,
        purchases_this_phase: 0,
        waves_until_next_fixed_battle: 1,
        waves_until_next_boss: 3,
        party_luck: 0,
        goal_profile: { w_run: 1, w_meta: 0 },
      },
      party_slots: [slot(level), slot(level - 2)],
      global_items: [],
      inventory: { pokeball_counts: [5, 0, 0, 0, 0] },
      offer: [],
    },
    candidates,
  };
  return { step_index: stepIndex, wave_index: wave, modifier_transition: { ...observation, selected_candidate_index: 0 } };
}

function job(step: number, alternativeIndex: number, candidateIndex: number, candidates: ModifierCandidate[]): RolloutJob {
  return {
    job_id: `k00${step}-a${alternativeIndex}`,
    branch_step: step,
    wave_index: step + 1,
    decision_stage: "reward",
    alternative: { candidate_index: candidateIndex, label: candidateLabel(candidates[candidateIndex]!) },
  };
}

test("records carry the advantage per alternative, skip steps without results and validate", () => {
  const steps = [rewardStep(0, 1, 6), rewardStep(1, 2, 8)];
  const reference = { wave_reached: 10, termination_reason: "team_wipe_or_game_over", steps };
  const candidates = steps[0]!.modifier_transition.candidates;
  const results: JobResult[] = [
    { job: job(0, 0, 1, candidates), status: "regular", outcome: { wave_reached: 9, final_party_level_sum: 20, termination_reason: "team_wipe_or_game_over" } },
    { job: job(0, 1, 2, candidates), status: "regular", outcome: { wave_reached: 12, final_party_level_sum: 25, termination_reason: "team_wipe_or_game_over" } },
    { job: job(1, 0, 1, candidates), status: "failed", reason: "replay_divergence:x" },
  ];
  const records = buildRolloutRecords("seed-a", "seed-a/reference", reference, results);
  assert.equal(records.length, 1);
  const record = validateRolloutRecord(JSON.parse(JSON.stringify(records[0])));
  assert.equal(record.reference_final_party_level_sum, 8 + 6);
  assert.deepEqual(record.alternatives.map(alternative => alternative.advantage_waves), [-1, 2]);

  const summary = summarizeRolloutRecords(records);
  assert.equal(summary.share_decisions_with_better_alternative, 1);
  assert.equal(summary.mean_best_single_deviation_gain, 2);
  assert.deepEqual(summary.by_family.map(row => row.family).sort(), ["reward:ball", "reward:temp_battle_booster"]);

  const broken = structuredClone(record);
  broken.alternatives[0]!.advantage_waves = 5;
  assert.throws(() => validateRolloutRecord(broken), /advantage mismatch/);
  const duplicate = structuredClone(record);
  duplicate.alternatives[1] = { ...duplicate.alternatives[0]! };
  assert.throws(() => validateRolloutRecord(duplicate), /duplicates/);
});
