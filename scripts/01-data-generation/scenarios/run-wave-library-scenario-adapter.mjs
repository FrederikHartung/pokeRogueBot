import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const defaultConfigPath = path.join(repoRoot, "data", "rl", "wave-library-scenario-adapter-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

if (!existsSync(configPath)) {
  throw new Error(`Wave library adapter config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);
const inputPath = config.input_path
  ? path.resolve(configDir, config.input_path)
  : path.join(repoRoot, "data", "offline-wave-library", "productive-wave-snapshots-v1.jsonl");
const outputDir = config.output_dir
  ? path.resolve(configDir, config.output_dir)
  : path.join(repoRoot, "data", "rl", "scenarios", "generated-wave-library-v2-w1-8");

if (!existsSync(inputPath)) {
  throw new Error(`Wave library input not found: ${inputPath}`);
}

if (config.clear_output_dir !== false && existsSync(outputDir)) {
  for (const name of readdirSync(outputDir)) {
    if (name.endsWith(".json")) {
      rmSync(path.join(outputDir, name), { force: true });
    }
  }
}

mkdirSync(outputDir, { recursive: true });

const allowedBattleTypes = toSet(config.allowed_battle_types, ["WILD", "TRAINER"]);
const hardWaves = toSet(config.hard_waves, [5, 8, 10]);
const benchmarkWaves = toSet(config.benchmark_waves, []);
const includeWaves = toSet(config.include_waves, []);
const excludeWaves = toSet(config.exclude_waves, []);
const includeFaintedPartyMembers = config.include_fainted_party_members !== false;

const lines = readFileSync(inputPath, "utf8")
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.length > 0);

let writtenCount = 0;
let skippedBattleType = 0;
let skippedDoubleFight = 0;
let skippedMystery = 0;
let skippedWaveFilters = 0;
let skippedMissingFieldState = 0;

for (const line of lines) {
  const record = JSON.parse(line);
  const fingerprint = String(record.fingerprint ?? "");
  const snapshot = record.snapshot;

  if (!snapshot || fingerprint.length === 0) {
    continue;
  }

  if (!allowedBattleTypes.has(String(snapshot.battleType))) {
    skippedBattleType += 1;
    continue;
  }

  if (snapshot.isDoubleFight === true) {
    skippedDoubleFight += 1;
    continue;
  }

  if (snapshot.mysteryEncounterType != null || snapshot.mysteryEncounterMode != null) {
    skippedMystery += 1;
    continue;
  }

  if (includeWaves.size > 0 && !includeWaves.has(Number(snapshot.waveIndex))) {
    skippedWaveFilters += 1;
    continue;
  }

  if (excludeWaves.has(Number(snapshot.waveIndex))) {
    skippedWaveFilters += 1;
    continue;
  }

  if (!hasActiveFieldMember(snapshot.playerTeam) || !hasActiveFieldMember(snapshot.enemyTeam)) {
    skippedMissingFieldState += 1;
    continue;
  }

  const scenario = toScenario({
    fingerprint,
    inputPath,
    snapshot,
    hardWaves,
    benchmarkWaves,
    includeFaintedPartyMembers,
  });

  const scenarioName = buildScenarioFileName(snapshot, fingerprint);
  const fullPath = path.join(outputDir, scenarioName);
  writeFileSync(fullPath, JSON.stringify(scenario, null, 2) + "\n", { encoding: "utf8" });
  writtenCount += 1;
}

console.log(`Wave library input: ${inputPath}`);
console.log(`Scenario output dir: ${outputDir}`);
console.log(`Scenario files written: ${writtenCount}`);
console.log(`Skipped (battle type): ${skippedBattleType}`);
console.log(`Skipped (double fight): ${skippedDoubleFight}`);
console.log(`Skipped (mystery encounter): ${skippedMystery}`);
console.log(`Skipped (wave filters): ${skippedWaveFilters}`);
console.log(`Skipped (missing on-field state): ${skippedMissingFieldState}`);

function toSet(values, defaults) {
  const source = Array.isArray(values) ? values : defaults;
  return new Set(source.map(value => Number.isInteger(value) ? Number(value) : String(value)));
}

function hasActiveFieldMember(team) {
  return Array.isArray(team) && team.some(member => member?.isOnField === true);
}

function toScenario({ fingerprint, inputPath, snapshot, hardWaves, benchmarkWaves, includeFaintedPartyMembers }) {
  const waveIndex = Number(snapshot.waveIndex);
  const difficulty = resolveDifficulty(waveIndex, hardWaves, benchmarkWaves);

  return {
    source: {
      snapshot_fingerprint: fingerprint,
      schema_version: Number(snapshot.schemaVersion ?? 1),
      snapshot_file: path.relative(repoRoot, inputPath).replaceAll(path.sep, "/"),
    },
    wave_index: waveIndex,
    battle_type: String(snapshot.battleType),
    battle_spec: String(snapshot.battleSpec ?? "DEFAULT"),
    battle_style: String(snapshot.battleStyle ?? "UNKNOWN"),
    is_double_fight: Boolean(snapshot.isDoubleFight),
    biome: snapshot.biome ?? null,
    trainer: toTrainer(snapshot),
    difficulty_group: difficulty.group,
    difficulty_reason: difficulty.reason,
    player_global_modifiers: toGlobalModifiers(snapshot.playerGlobalModifiers),
    enemy_global_modifiers: toGlobalModifiers(snapshot.enemyGlobalModifiers),
    player_team: toTeam(snapshot.playerTeam, includeFaintedPartyMembers),
    enemy_team: toTeam(snapshot.enemyTeam, true),
  };
}

function toTrainer(snapshot) {
  const hasTrainerData = snapshot.trainerType != null
    || snapshot.trainerName != null
    || snapshot.trainerDisplayName != null
    || snapshot.trainerIsBoss != null
    || snapshot.trainerSpecialtyType != null;

  if (!hasTrainerData) {
    return null;
  }

  return {
    trainer_type: snapshot.trainerType ?? null,
    trainer_name: snapshot.trainerName ?? null,
    trainer_display_name: snapshot.trainerDisplayName ?? null,
    trainer_is_boss: snapshot.trainerIsBoss ?? null,
    trainer_specialty_type: snapshot.trainerSpecialtyType ?? null,
  };
}

function toGlobalModifiers(modifiers) {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers.map(modifier => ({
    type_id: Number(modifier.typeId),
    name: String(modifier.name),
    modifier_class: String(modifier.modifierClass),
    stack_count: toNullableInteger(modifier.stackCount),
    virtual_stack_count: toNullableInteger(modifier.virtualStackCount),
    total_stack_count: toNullableInteger(modifier.totalStackCount),
    max_stack_count: toNullableInteger(modifier.maxStackCount),
    battle_count: toNullableInteger(modifier.battleCount),
  }));
}

function toTeam(team, includeFaintedMembers) {
  if (!Array.isArray(team)) {
    return [];
  }

  return team
    .filter(member => includeFaintedMembers || Number(member?.hp ?? 0) > 0)
    .map(toTeamMember);
}

function toTeamMember(member) {
  return {
    id: Number(member.id),
    name: String(member.name),
    species_id: Number(member.speciesId),
    species_name: String(member.speciesName),
    form_index: Number(member.formIndex ?? 0),
    level: Number(member.level),
    gender: member.gender ?? null,
    nature: String(member.nature),
    hp: Number(member.hp),
    max_hp: Number(member.stats?.hp ?? member.hp),
    ivs: toStats(member.ivs),
    stats: toStats(member.stats),
    battle_stats: member.battleStats == null ? null : toStats(member.battleStats),
    stat_stages: Array.isArray(member.statStages) ? member.statStages.map(value => Number(value)) : [],
    status: member.status == null
      ? null
      : {
          effect: String(member.status.effect),
          turnCount: Number(member.status.turnCount ?? 0),
        },
    moveset: Array.isArray(member.moveset) ? member.moveset.map(toMove) : [],
    current_ability_id: Number(member.currentAbilityId),
    current_ability_name: String(member.currentAbilityName),
    passive_ability_id: toNullableInteger(member.passiveAbilityId),
    passive_ability_name: member.passiveAbilityName ?? null,
    ability_suppressed: Boolean(member.abilitySuppressed),
    held_items: Array.isArray(member.heldItems) ? member.heldItems.map(toHeldItem) : [],
    is_on_field: member.isOnField === true,
    active_field_slot_index: toNullableInteger(member.activeFieldSlotIndex),
    is_boss: member.isBoss === true,
    boss_segments: Number(member.bossSegments ?? 0),
    is_shiny: member.isShiny === true,
    player: member.player === true,
  };
}

function toStats(stats) {
  return {
    hp: Number(stats.hp),
    attack: Number(stats.attack),
    defense: Number(stats.defense),
    specialAttack: Number(stats.specialAttack),
    specialDefense: Number(stats.specialDefense),
    speed: Number(stats.speed),
  };
}

function toMove(move) {
  return {
    id: Number(move.id),
    name: String(move.name),
    move_pp: Number(move.movePp ?? 0),
    pp_used: Number(move.pPUsed ?? 0),
    pp_left: Number(move.pPLeft ?? 0),
    is_usable: move.isUsable === true,
  };
}

function toHeldItem(item) {
  return {
    type_id: Number(item.typeId),
    name: String(item.name),
    modifier_class: String(item.modifierClass),
    stack_count: Number(item.stackCount ?? 0),
    is_transferable: item.isTransferable === true,
  };
}

function toNullableInteger(value) {
  return Number.isInteger(value) ? Number(value) : null;
}

function resolveDifficulty(waveIndex, hardWaves, benchmarkWaves) {
  if (benchmarkWaves.has(waveIndex)) {
    return {
      group: "benchmark",
      reason: hardWaveReason(waveIndex),
    };
  }

  if (hardWaves.has(waveIndex)) {
    return {
      group: "hard",
      reason: hardWaveReason(waveIndex),
    };
  }

  return {
    group: "core",
    reason: null,
  };
}

function hardWaveReason(waveIndex) {
  if (waveIndex === 5) {
    return "wave_5_first_trainer";
  }
  if (waveIndex === 8) {
    return "wave_8_first_rival";
  }
  if (waveIndex === 10) {
    return "wave_10_first_boss";
  }
  return `wave_${waveIndex}`;
}

function buildScenarioFileName(snapshot, fingerprint) {
  const battleType = String(snapshot.battleType ?? "unknown").toLowerCase();
  const safeBattleType = battleType.replace(/[^a-z0-9_-]/g, "_");
  const waveIndex = Number(snapshot.waveIndex ?? 0);
  return `${safeBattleType}-w${waveIndex}-${fingerprint.slice(0, 12)}.json`;
}
