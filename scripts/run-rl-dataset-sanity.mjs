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
  if (!Array.isArray(mask) || mask.length !== 4 || mask.some(v => v !== 0 && v !== 1)) {
    issues.push(`[line ${lineNo}] invalid action_mask`);
  } else if (Number.isInteger(row.action) && (row.action < 0 || row.action >= 4)) {
    issues.push(`[line ${lineNo}] action out of range [0..3]`);
  } else if (Number.isInteger(row.action) && mask[row.action] !== 1) {
    issues.push(`[line ${lineNo}] action not allowed by action_mask`);
  }

  const playerTypes = row?.state?.player_types;
  if (!Array.isArray(playerTypes) || playerTypes.length < 1 || playerTypes.length > 2 || playerTypes.some(v => !Number.isInteger(v) || v < 0)) {
    issues.push(`[line ${lineNo}] invalid player_types`);
  }

  const enemyTypes = row?.state?.enemy_types;
  if (!Array.isArray(enemyTypes) || enemyTypes.length < 1 || enemyTypes.length > 2 || enemyTypes.some(v => !Number.isInteger(v) || v < 0)) {
    issues.push(`[line ${lineNo}] invalid enemy_types`);
  }

  const moveEffectiveness = row?.state?.move_effectiveness;
  if (!Array.isArray(moveEffectiveness) || moveEffectiveness.length !== 4 || moveEffectiveness.some(v => typeof v !== "number" || Number.isNaN(v) || v < 0)) {
    issues.push(`[line ${lineNo}] invalid move_effectiveness`);
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
