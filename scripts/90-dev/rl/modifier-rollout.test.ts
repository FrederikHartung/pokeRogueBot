import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ModifierCandidate,
  ModifierObservation,
  PartySlot,
} from "../../../src/main/ts/lib/modifier-observation.ts";
import { pickHeuristicV1TargetIndex } from "../../../src/main/ts/lib/modifier-heuristic-policy.ts";
import {
  buildRolloutJobs,
  buildRolloutSpec,
  candidateLabel,
  listRolloutAlternatives,
  observationHash,
  type ReferenceStepRecord,
  referenceStepsOf,
  RolloutReplayController,
  validateRolloutSpec,
} from "../../../src/main/ts/lib/modifier-rollout.ts";

function slot(overrides: Partial<PartySlot> = {}): PartySlot {
  return {
    present: 1,
    fainted: 0,
    hp_ratio: 1,
    level: 10,
    level_ratio_to_cap: 0.5,
    status: 0,
    types: [0],
    base_stat_total: 300,
    move_count: 3,
    min_pp_ratio: 1,
    held_items: [],
    ...overrides,
  };
}

function observation(stage: "shop" | "reward", party: PartySlot[], candidates: ModifierCandidate[], wave = 7): ModifierObservation {
  return {
    schema_version: "modifier-v1",
    decision_stage: stage,
    state: {
      run: {
        wave_index: wave,
        money: 500,
        reroll_cost: 250,
        reroll_count: 0,
        lock_rarities: 0,
        shop_available: 1,
        purchases_this_phase: 0,
        waves_until_next_fixed_battle: 1,
        waves_until_next_boss: 3,
        party_luck: 0,
        goal_profile: { w_run: 1, w_meta: 0 },
      },
      party_slots: party,
      global_items: [],
      inventory: { pokeball_counts: [5, 0, 0, 0, 0] },
      offer: [],
    },
    candidates,
  };
}

function reward(rewardIndex: number, itemId: string, family: ModifierCandidate["item_family"], extra: Partial<ModifierCandidate> = {}): ModifierCandidate {
  return { kind: "take_reward", mask: 1, reward_index: rewardIndex, item_id: itemId, item_family: family, tier: 0, cost: 0, ...extra };
}

function buy(itemId: string, family: ModifierCandidate["item_family"], extra: Partial<ModifierCandidate> = {}): ModifierCandidate {
  return { kind: "buy_shop_item", mask: 1, shop_row_index: 0, shop_column_index: 0, item_id: itemId, item_family: family, tier: 0, cost: 50, ...extra };
}

const FINISH: ModifierCandidate = { kind: "finish_shop", mask: 1, tier: -1, cost: 0 };
const PARTY = [slot({ level: 12 }), slot({ level: 15 }), slot({ level: 9, hp_ratio: 0.2 })];

function rewardObservation(): ModifierObservation {
  return observation("reward", PARTY, [
    reward(0, "RARE_CANDY", "level_up", { target_party_index: 0 }),
    reward(0, "RARE_CANDY", "level_up", { target_party_index: 1 }),
    reward(0, "RARE_CANDY", "level_up", { target_party_index: 2 }),
    reward(1, "POTION", "heal_hp", { target_party_index: 0, effect: { hp_restore_ratio: 0.3 } }),
    reward(1, "POTION", "heal_hp", { target_party_index: 2, effect: { hp_restore_ratio: 0.3 } }),
    reward(2, "POKEBALL", "ball"),
    reward(3, "X_ATTACK", "temp_battle_booster", { mask: 0 }),
    { kind: "skip", mask: 0, tier: -1, cost: 0 },
  ]);
}

test("labels distinguish item, variant, position and target; variant keys are order independent", () => {
  const a = reward(0, "BERRY", "berry", { variant: { berry: 3, x: 1 }, target_party_index: 1 });
  const b = reward(0, "BERRY", "berry", { variant: { x: 1, berry: 3 }, target_party_index: 1 });
  assert.equal(candidateLabel(a), candidateLabel(b));
  assert.equal(candidateLabel(a), "take_reward|BERRY|berry=3,x=1|0|||1|");
  assert.notEqual(candidateLabel(a), candidateLabel({ ...a, target_party_index: 2 }));
  assert.notEqual(candidateLabel(a), candidateLabel({ ...a, reward_index: 1 }));
});

test("observation hash survives a JSON round trip and changes with the state", () => {
  const live = rewardObservation();
  const stored = JSON.parse(JSON.stringify({ ...live, selected_candidate_index: 1 })) as ModifierObservation;
  assert.equal(observationHash(stored), observationHash(live));
  const changed = rewardObservation();
  changed.state.run.money = 501;
  assert.notEqual(observationHash(changed), observationHash(live));
});

test("reward alternatives: every other offered item once, target by heuristic rules, masked items left out", () => {
  const obs = rewardObservation();
  const alternatives = listRolloutAlternatives(obs, 1, pickHeuristicV1TargetIndex, { firstShopDecisionInWave: false });
  // Trank auf den Slot mit dem niedrigsten HP-Anteil (Index 4), Ball ohne Ziel (5); X_ATTACK ist gesperrt.
  assert.deepEqual(alternatives.map(alternative => alternative.candidate_index), [4, 5]);
  assert.equal(alternatives[0]!.label, candidateLabel(obs.candidates[4]!));
  assert.equal(listRolloutAlternatives(obs, 1, pickHeuristicV1TargetIndex, { firstShopDecisionInWave: false, maxAlternatives: 1 }).length, 1);
});

test("shop alternatives: finish_shop only for a purchase in the first shop decision of a wave", () => {
  const obs = observation("shop", PARTY, [buy("POTION", "heal_hp", { target_party_index: 2 }), FINISH]);
  assert.deepEqual(listRolloutAlternatives(obs, 0, pickHeuristicV1TargetIndex, { firstShopDecisionInWave: true }), [
    { candidate_index: 1, label: candidateLabel(FINISH) },
  ]);
  assert.deepEqual(listRolloutAlternatives(obs, 0, pickHeuristicV1TargetIndex, { firstShopDecisionInWave: false }), []);
  assert.deepEqual(listRolloutAlternatives(obs, 1, pickHeuristicV1TargetIndex, { firstShopDecisionInWave: true }), []);
});

function referenceRun(): ReferenceStepRecord[] {
  const shop = observation("shop", PARTY, [buy("POTION", "heal_hp", { target_party_index: 2 }), FINISH], 3);
  const shopAgain = observation("shop", PARTY, [buy("POTION", "heal_hp", { target_party_index: 2 }), FINISH], 3);
  shopAgain.state.run.purchases_this_phase = 1;
  const rewardStep = rewardObservation();
  return [
    { step_index: 0, wave_index: 3, modifier_transition: { ...shop, selected_candidate_index: 0 } },
    { step_index: 1, wave_index: 3, modifier_transition: { ...shopAgain, selected_candidate_index: 0 } },
    { step_index: 2, wave_index: 3, modifier_transition: { ...rewardStep, selected_candidate_index: 1 } },
  ];
}

test("jobs cover the first shop decision of a wave and each reward alternative", () => {
  const jobs = buildRolloutJobs(referenceRun(), pickHeuristicV1TargetIndex);
  assert.deepEqual(jobs.map(job => job.job_id), ["k000-a0", "k002-a0", "k002-a1"]);
  assert.deepEqual(jobs.map(job => job.branch_step), [0, 2, 2]);
});

test("replay controller follows the reference, takes the alternative, then hands over to the continuation", () => {
  const steps = referenceRun();
  const reference = referenceStepsOf(steps);
  const job = buildRolloutJobs(steps, pickHeuristicV1TargetIndex).find(entry => entry.job_id === "k002-a0")!;
  const spec = validateRolloutSpec(JSON.parse(JSON.stringify(buildRolloutSpec("seed-a/reference", "seed-a", reference, job))));
  const controller = new RolloutReplayController(spec);
  assert.throws(() => controller.assertBranchReached(), /ended_before_branch/);
  assert.deepEqual(controller.choose(0, steps[0]!.modifier_transition), { source: "replay", candidateIndex: 0 });
  assert.deepEqual(controller.choose(1, steps[1]!.modifier_transition), { source: "replay", candidateIndex: 0 });
  assert.deepEqual(controller.choose(2, steps[2]!.modifier_transition), { source: "alternative", candidateIndex: 4 });
  assert.deepEqual(controller.choose(3, steps[2]!.modifier_transition), { source: "continuation" });
  controller.assertBranchReached();
  assert.equal(controller.episodeInfo().replay_verified_steps, 3);
});

test("replay controller aborts on a different state or a missing label", () => {
  const steps = referenceRun();
  const reference = referenceStepsOf(steps);
  const spec = buildRolloutSpec("seed-a/reference", "seed-a", reference, { branch_step: 2, alternative: { candidate_index: 4, label: "x" } });
  const changed = structuredClone(steps[0]!.modifier_transition);
  changed.state.run.money = 1;
  assert.throws(() => new RolloutReplayController(spec).choose(0, changed), /replay_divergence:state_hash:step=0/);

  const controller = new RolloutReplayController(spec);
  controller.choose(0, steps[0]!.modifier_transition);
  controller.choose(1, steps[1]!.modifier_transition);
  assert.throws(() => controller.choose(2, steps[2]!.modifier_transition), /replay_divergence:label:step=2/);
});

test("spec validation rejects a prefix that does not end at the branch step", () => {
  const reference = referenceStepsOf(referenceRun());
  const spec = buildRolloutSpec("r", "seed-a", reference, { branch_step: 1, alternative: { candidate_index: 1, label: "y" } });
  assert.doesNotThrow(() => validateRolloutSpec(spec));
  assert.throws(() => validateRolloutSpec({ ...spec, reference_steps: reference }), /reference steps/);
});
