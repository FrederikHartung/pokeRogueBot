import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const inputArg = process.argv[2] ?? "./data/rl/combat/train-benchmarked-wave-library-v2.jsonl";
const inputPath = path.resolve(inputArg);

if (!existsSync(inputPath)) {
  console.error(`Dataset not found: ${inputPath}`);
  process.exit(1);
}

const lines = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter(Boolean);

const issues = [];
let parsedCount = 0;

for (let i = 0; i < lines.length; i += 1) {
  const lineNo = i + 1;
  let row;

  try {
    row = JSON.parse(lines[i]);
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

  if (typeof row.reward !== "number" || Number.isNaN(row.reward)) {
    issues.push(`[line ${lineNo}] reward is not a valid number`);
  }
}

console.log(`Dataset: ${inputPath}`);
console.log(`Rows: ${lines.length}`);
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
