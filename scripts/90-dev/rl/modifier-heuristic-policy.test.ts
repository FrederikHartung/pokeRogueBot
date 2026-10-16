import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ModifierCandidate,
  ModifierObservation,
  PartySlot,
} from "../../../src/main/ts/lib/modifier-observation.ts";
import { pickHeuristicV1CandidateIndex } from "../../../src/main/ts/lib/modifier-heuristic-policy.ts";

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

const EMPTY_SLOT: PartySlot = { ...slot(), present: 0 };

function observation(
  stage: "shop" | "reward",
  party: PartySlot[],
  candidates: ModifierCandidate[],
): ModifierObservation {
  return {
    schema_version: "modifier-v1",
    decision_stage: stage,
    state: {
      run: {
        wave_index: 7,
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
      party_slots: [...party, ...Array.from({ length: 6 - party.length }, () => EMPTY_SLOT)],
      global_items: [],
      inventory: { pokeball_counts: [5, 0, 0, 0, 0] },
      offer: [],
    },
    candidates,
  };
}

function item(
  kind: "take_reward" | "buy_shop_item",
  itemId: string,
  family: ModifierCandidate["item_family"],
  extra: Partial<ModifierCandidate> = {},
): ModifierCandidate {
  return { kind, mask: 1, item_id: itemId, item_family: family, tier: 0, cost: kind === "take_reward" ? 0 : 50, ...extra };
}

const FINISH: ModifierCandidate = { kind: "finish_shop", mask: 1, tier: -1, cost: 0 };
const REROLL: ModifierCandidate = { kind: "reroll", mask: 1, tier: -1, cost: 250 };
const SKIP_MASKED: ModifierCandidate = { kind: "skip", mask: 0, mask_reason: "skip_while_free_reward", tier: -1, cost: 0 };

test("shop: heals the most injured Pokemon with the cheapest potion that covers the missing HP", () => {
  const party = [slot({ hp_ratio: 0.8 }), slot({ hp_ratio: 0.3 }), slot()];
  const candidates = [
    item("buy_shop_item", "POTION", "heal_hp", { target_party_index: 0, cost: 40, effect: { hp_restore_ratio: 0.2 } }),
    item("buy_shop_item", "POTION", "heal_hp", { target_party_index: 1, cost: 40, effect: { hp_restore_ratio: 0.4 } }),
    item("buy_shop_item", "SUPER_POTION", "heal_hp", { target_party_index: 1, cost: 90, effect: { hp_restore_ratio: 0.7 } }),
    item("buy_shop_item", "HYPER_POTION", "heal_hp", { target_party_index: 1, cost: 160, effect: { hp_restore_ratio: 0.7 } }),
    FINISH,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("shop", party, candidates)), 2);
});

test("shop: falls back to the biggest heal when nothing covers the missing HP", () => {
  const party = [slot({ hp_ratio: 0.1 })];
  const candidates = [
    item("buy_shop_item", "POTION", "heal_hp", { target_party_index: 0, cost: 40, effect: { hp_restore_ratio: 0.3 } }),
    item("buy_shop_item", "SUPER_POTION", "heal_hp", { target_party_index: 0, cost: 90, effect: { hp_restore_ratio: 0.6 } }),
    FINISH,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("shop", party, candidates)), 1);
});

test("shop: revives before healing and finishes once nothing is needed", () => {
  const party = [slot({ hp_ratio: 0.5 }), slot({ fainted: 1, hp_ratio: 0 })];
  const candidates = [
    item("buy_shop_item", "POTION", "heal_hp", { target_party_index: 0, cost: 40, effect: { hp_restore_ratio: 0.5 } }),
    item("buy_shop_item", "REVIVE", "revive", { target_party_index: 1, cost: 400, effect: { hp_restore_ratio: 0.5 } }),
    FINISH,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("shop", party, candidates)), 1);

  const healthy = [slot(), slot()];
  const unaffordable = [
    { ...item("buy_shop_item", "REVIVE", "revive", { target_party_index: 1 }), mask: 0, mask_reason: "insufficient_money" },
    FINISH,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("shop", healthy, unaffordable)), 1);
});

test("shop: buys a status heal only for a Pokemon the game allows", () => {
  const party = [slot({ status: 3 })];
  const candidates = [item("buy_shop_item", "FULL_HEAL", "heal_status", { target_party_index: 0, cost: 200 }), FINISH];
  assert.equal(pickHeuristicV1CandidateIndex(observation("shop", party, candidates)), 0);
});

test("reward: takes a heal only below half HP, otherwise follows the priority list", () => {
  const candidates = [
    item("take_reward", "POTION", "heal_hp", { reward_index: 0, target_party_index: 0, effect: { hp_restore_ratio: 0.2 } }),
    item("take_reward", "POKEBALL", "ball", { reward_index: 1 }),
    item("take_reward", "RARE_CANDY", "level_up", { reward_index: 2, target_party_index: 0 }),
    item("take_reward", "RARE_CANDY", "level_up", { reward_index: 2, target_party_index: 1 }),
    REROLL,
    SKIP_MASKED,
  ];
  // Sonderbonbon auf das Pokemon mit dem hoechsten Level.
  const mildlyHurt = [slot({ hp_ratio: 0.8, level: 8 }), slot({ level: 12 })];
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", mildlyHurt, candidates)), 3);
  const badlyHurt = [slot({ hp_ratio: 0.4, level: 8 }), slot({ level: 12 })];
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", badlyHurt, candidates)), 0);
});

test("reward: prefers anything over lures and balls and never rerolls", () => {
  const party = [slot()];
  const candidates = [
    item("take_reward", "POKEBALL", "ball", { reward_index: 0, tier: 0 }),
    item("take_reward", "SUPER_LURE", "lure", { reward_index: 1, tier: 1 }),
    item("take_reward", "MINT", "nature", { reward_index: 2, tier: 2, target_party_index: 0 }),
    REROLL,
    SKIP_MASKED,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", party, candidates)), 2);
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", party, candidates.filter((_, index) => index !== 2))), 1);
});

test("reward: skips only when no free reward is executable", () => {
  const party = [slot()];
  const candidates = [
    { ...item("take_reward", "TM_COMMON", "tm", { reward_index: 0 }), mask: 0, mask_reason: "blocked" },
    REROLL,
    { kind: "skip", mask: 1, tier: -1, cost: 0 } satisfies ModifierCandidate,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", party, candidates)), 2);
});

test("reward: targets the move slot with the lowest PP for ethers", () => {
  const party = [slot({ min_pp_ratio: 0.9, level: 20 }), slot({ min_pp_ratio: 0.2, level: 5 })];
  const candidates = [
    item("take_reward", "ETHER", "pp_restore", { reward_index: 0, target_party_index: 0, target_move_index: 1 }),
    item("take_reward", "ETHER", "pp_restore", { reward_index: 0, target_party_index: 1, target_move_index: 0 }),
    SKIP_MASKED,
  ];
  assert.equal(pickHeuristicV1CandidateIndex(observation("reward", party, candidates)), 1);
});
