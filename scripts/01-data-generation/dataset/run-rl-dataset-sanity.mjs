import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const inputArg = process.argv[2] ?? "./data/rl/combat/train-benchmarked-wave-library-v2.jsonl";
const inputPath = path.resolve(inputArg);

if (!existsSync(inputPath)) {
  console.error(`Dataset not found: ${inputPath}`);
  process.exit(1);
}

const issues = [];
let parsedCount = 0;
let rowCount = 0;
const stateVersionCounts = { "combat-v3": 0, "combat-v4": 0 };

const isIntIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const isNumIn = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const VOLATILE_KEYS = ["confused", "seeded", "substitute", "trapped", "locked_into_move", "taunted", "infatuated", "drowsy", "perish_song"];
const SIDE_KEYS = [["spikes_layers", 3], ["toxic_spikes_layers", 2], ["stealth_rock", 1], ["sticky_web", 1], ["reflect", 1], ["light_screen", 1], ["aurora_veil", 1], ["tailwind", 1]];

// combat-v4-Zusatzfelder (docs/rl-schema/combat-transition.schema.json); v3-Felder prueft der gemeinsame Teil unten.
function checkBattler(battler, label, lineNo) {
  if (!battler || typeof battler !== "object") {
    issues.push(`[line ${lineNo}] missing ${label}`);
    return;
  }
  if (!isIntIn(battler.status, 0, 6)) {
    issues.push(`[line ${lineNo}] invalid ${label}.status`);
  }
  if (!Array.isArray(battler.stat_stages) || battler.stat_stages.length !== 7 || battler.stat_stages.some(v => !isIntIn(v, -6, 6))) {
    issues.push(`[line ${lineNo}] invalid ${label}.stat_stages`);
  }
  for (const key of VOLATILE_KEYS) {
    if (!isIntIn(battler.volatile?.[key], 0, 1)) {
      issues.push(`[line ${lineNo}] invalid ${label}.volatile.${key}`);
    }
  }
}

function checkCombatV4State(state, lineNo, label) {
  const kind = state.decision_kind;
  if (!isIntIn(kind, 0, 2)) {
    issues.push(`[line ${lineNo}] invalid ${label}.decision_kind`);
  }
  for (const [field, max] of [["last_action_was_switch", 1], ["consecutive_switch_bucket", 3], ["battle_turn_bucket", 4]]) {
    if (!isIntIn(state[field], 0, max)) {
      issues.push(`[line ${lineNo}] invalid ${label}.${field}`);
    }
  }
  checkBattler(state.active, `${label}.active`, lineNo);
  checkBattler(state.enemy, `${label}.enemy`, lineNo);
  if (!isIntIn(state.enemy?.remaining_team_count, 0, 6) || !isNumIn(state.enemy?.team_hp_ratio, 0, 1)) {
    issues.push(`[line ${lineNo}] invalid ${label}.enemy team fields`);
  }
  const field = state.field;
  if (!field || !isIntIn(field.weather, 0, 9) || !isIntIn(field.terrain, 0, 4) || !isIntIn(field.trick_room, 0, 1)) {
    issues.push(`[line ${lineNo}] invalid ${label}.field`);
  } else {
    for (const side of ["player_side", "enemy_side"]) {
      for (const [key, max] of SIDE_KEYS) {
        if (!isIntIn(field[side]?.[key], 0, max)) {
          issues.push(`[line ${lineNo}] invalid ${label}.field.${side}.${key}`);
        }
      }
    }
  }
  for (const [idx, move] of (Array.isArray(state.moves) ? state.moves : []).entries()) {
    if (!isNumIn(move?.estimated_damage_ratio, 0, 2) || !isNumIn(move?.pp_ratio, 0, 1)
      || !isIntIn(move?.effect_category, 0, 8) || !isIntIn(move?.effect_still_useful, 0, 1) || !isIntIn(move?.power_bucket, 0, 4)) {
      issues.push(`[line ${lineNo}] invalid ${label}.moves[${idx}] combat-v4 fields`);
    }
  }
  for (const [idx, slot] of (Array.isArray(state.party_slots) ? state.party_slots : []).entries()) {
    if (!isIntIn(slot?.status, 0, 6) || !isIntIn(slot?.is_last_switch_origin, 0, 1)) {
      issues.push(`[line ${lineNo}] invalid ${label}.party_slots[${idx}] combat-v4 fields`);
    }
  }
  const mask = Array.isArray(state.action_mask) ? state.action_mask : [];
  if ((kind === 1 || kind === 2) && mask.slice(0, 4).some(v => v === 1)) {
    issues.push(`[line ${lineNo}] ${label}: move actions must be masked for decision_kind ${kind}`);
  }
  if (kind === 2) {
    const activeSlot = Array.isArray(state.party_slots) ? state.party_slots.findIndex(slot => slot?.active === 1) : -1;
    if (activeSlot < 0 || mask[4 + activeSlot] !== 1) {
      issues.push(`[line ${lineNo}] ${label}: check_switch must allow staying (active slot)`);
    }
  }
}

const reader = readline.createInterface({
  input: createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let lineNo = 0;
for await (const line of reader) {
  if (!line) {
    continue;
  }

  lineNo += 1;
  rowCount += 1;
  let row;

  try {
    row = JSON.parse(line);
  } catch {
    issues.push(`[line ${lineNo}] invalid json`);
    continue;
  }

  parsedCount += 1;

  if (!row || typeof row !== "object") {
    issues.push(`[line ${lineNo}] row is not an object`);
    continue;
  }

  if (!row.state || typeof row.state !== "object") {
    issues.push(`[line ${lineNo}] missing state`);
  }

  if (!row.next_state || typeof row.next_state !== "object") {
    issues.push(`[line ${lineNo}] missing next_state`);
  }

  if (!Number.isInteger(row.action)) {
    issues.push(`[line ${lineNo}] action is not an integer`);
  }

  if (typeof row.done !== "boolean") {
    issues.push(`[line ${lineNo}] done is not boolean`);
  }

  const actionSource = row?.meta?.action_source;
  if (
    actionSource != null
    && !["random", "scheduled_random", "first_valid", "external_command", "model", "unknown"].includes(actionSource)
  ) {
    issues.push(`[line ${lineNo}] invalid meta.action_source`);
  }

  const mask = row?.state?.action_mask;
  if (!Array.isArray(mask) || mask.length < 4 || mask.some(v => v !== 0 && v !== 1)) {
    issues.push(`[line ${lineNo}] invalid action_mask`);
  } else if (Number.isInteger(row.action) && (row.action < 0 || row.action >= mask.length)) {
    issues.push(`[line ${lineNo}] action out of range [0..${mask.length - 1}]`);
  } else if (Number.isInteger(row.action) && mask[row.action] !== 1) {
    issues.push(`[line ${lineNo}] action not allowed by action_mask`);
  }

  const bucketFields = [
    "player_hp_bucket",
    "enemy_hp_bucket",
    "hp_diff_bucket",
    "level_gap_bucket",
    "is_trainer_battle",
    "has_legal_switch",
    "active_hp_critical",
    "bench_has_healthier_switch",
    "bench_has_better_matchup_than_active",
    "active_can_finish_enemy",
    "alive_bench_count_bucket",
    "healthy_bench_count_bucket",
    "best_switch_matchup_bucket",
    "worst_switch_risk_bucket",
    "speed_order_advantage",
    "enemy_has_known_priority_threat",
    "active_has_any_first_strike_move",
    "active_best_damage_bucket",
    "enemy_best_damage_into_active_bucket",
    "active_survives_next_hit",
    "enemy_survives_best_hit",
  ];
  for (const field of bucketFields) {
    if (!Number.isInteger(row?.state?.[field])) {
      issues.push(`[line ${lineNo}] invalid ${field}`);
    }
  }

  const moves = row?.state?.moves;
  if (!Array.isArray(moves) || moves.length > 4) {
    issues.push(`[line ${lineNo}] invalid v2 moves`);
  } else {
    for (let idx = 0; idx < moves.length; idx += 1) {
      const move = moves[idx];
      if (!move || typeof move !== "object") {
        issues.push(`[line ${lineNo}] invalid move at index ${idx}`);
        continue;
      }
      const moveFields = [
        "available",
        "power_bucket",
        "effectiveness_bucket",
        "stab",
        "pp_low",
        "priority_bucket",
        "acts_first_if_used",
        "can_ko_before_enemy_moves",
        "move_kind_bucket",
        "damage_class_bucket",
        "estimated_damage_ratio_bucket",
        "estimated_ko_turns_bucket",
        "accuracy_bucket",
        "uses_best_offense_stat",
        "target_immunity_risk",
      ];
      for (const field of moveFields) {
        if (!Number.isInteger(move[field])) {
          issues.push(`[line ${lineNo}] invalid move.${field} at index ${idx}`);
        }
      }
    }
  }

  const partySlots = row?.state?.party_slots;
  if (!Array.isArray(partySlots) || partySlots.length !== 6) {
    issues.push(`[line ${lineNo}] invalid party_slots`);
  } else {
    for (let idx = 0; idx < partySlots.length; idx += 1) {
      const slot = partySlots[idx];
      if (!slot || typeof slot !== "object") {
        issues.push(`[line ${lineNo}] invalid party_slot at index ${idx}`);
        continue;
      }
      const slotFields = [
        "present",
        "active",
        "fainted",
        "hp_ratio",
        "level",
        "best_damage_into_enemy_bucket",
        "expected_incoming_damage_bucket",
        "speed_advantage_bucket",
        "survives_one_hit",
        "can_threaten_ko_bucket",
      ];
      for (const field of slotFields) {
        if (!Number.isFinite(slot[field])) {
          issues.push(`[line ${lineNo}] invalid party_slot.${field} at index ${idx}`);
        }
      }
      if (!Array.isArray(slot.types)) {
        issues.push(`[line ${lineNo}] invalid party_slot.types at index ${idx}`);
      }
    }
  }

  const stateVersion = row?.meta?.state_schema_version === "combat-v4" || row?.state?.decision_kind != null
    ? "combat-v4"
    : "combat-v3";
  stateVersionCounts[stateVersion] += 1;
  if (stateVersion === "combat-v4") {
    if (row?.meta?.state_schema_version !== "combat-v4") {
      issues.push(`[line ${lineNo}] combat-v4 state without meta.state_schema_version`);
    }
    if (row.state && typeof row.state === "object") {
      checkCombatV4State(row.state, lineNo, "state");
    }
    if (row.next_state && typeof row.next_state === "object") {
      checkCombatV4State(row.next_state, lineNo, "next_state");
    }
  }

  if (typeof row.reward !== "number" || Number.isNaN(row.reward)) {
    issues.push(`[line ${lineNo}] reward is not a valid number`);
  }
}

if (stateVersionCounts["combat-v3"] > 0 && stateVersionCounts["combat-v4"] > 0) {
  issues.push(
    `dataset mixes combat-v3 (${stateVersionCounts["combat-v3"]}) and combat-v4 (${stateVersionCounts["combat-v4"]}) rows; use separate dataset pools`,
  );
}

console.log(`Dataset: ${inputPath}`);
console.log(`State versions: combat-v3=${stateVersionCounts["combat-v3"]} combat-v4=${stateVersionCounts["combat-v4"]}`);
console.log(`Rows: ${rowCount}`);
console.log(`Parsed rows: ${parsedCount}`);
console.log(`Issues: ${issues.length}`);

if (issues.length > 0) {
  for (const issue of issues.slice(0, 50)) {
    console.log(issue);
  }
  if (issues.length > 50) {
    console.log(`... and ${issues.length - 50} more`);
  }
  process.exit(2);
}

console.log("Sanity check passed.");
