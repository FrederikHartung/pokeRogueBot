import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const inputArg = process.argv[2] ?? "./data/rl/combat/train-benchmarked-mixed.jsonl";
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
    "alive_bench_count_bucket",
    "healthy_bench_count_bucket",
    "best_switch_matchup_bucket",
    "worst_switch_risk_bucket",
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
      const moveFields = ["available", "power_bucket", "effectiveness_bucket", "stab", "pp_low"];
      for (const field of moveFields) {
        if (!Number.isInteger(move[field])) {
          issues.push(`[line ${lineNo}] invalid move.${field} at index ${idx}`);
        }
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
