import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const tempRunId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", tempRunId);
const tempTestRelativePath = path.join("test", ".external-rl", tempRunId, "experience-collector.test.ts");
const tempTestPath = path.join(pokerogueRoot, tempTestRelativePath);

const defaultConfigPath = path.join(repoRoot, "data", "rl", "collector-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

function assertScenarioV2(scenario, sourcePath) {
  const hasSource = scenario?.source != null;
  const hasWaveIndex = Number.isInteger(scenario?.wave_index);
  const hasBattleType = typeof scenario?.battle_type === "string" && scenario.battle_type.length > 0;
  const hasBattleSpec = typeof scenario?.battle_spec === "string" && scenario.battle_spec.length > 0;
  const hasBattleStyle = typeof scenario?.battle_style === "string" && scenario.battle_style.length > 0;
  const hasDoubleFlag = typeof scenario?.is_double_fight === "boolean";
  const hasPlayerTeam = Array.isArray(scenario?.player_team) && scenario.player_team.length > 0;
  const hasEnemyTeam = Array.isArray(scenario?.enemy_team) && scenario.enemy_team.length > 0;

  if (hasSource && hasWaveIndex && hasBattleType && hasBattleSpec && hasBattleStyle && hasDoubleFlag && hasPlayerTeam && hasEnemyTeam) {
    return;
  }

  throw new Error(
    "Collector requires combat-scenario-v2 input. Invalid scenario: "
    + sourcePath
    + " (expected source, wave_index, battle_type, battle_spec, battle_style, is_double_fight, player_team, enemy_team)",
  );
}

if (!existsSync(configPath)) {
  throw new Error(`Collector config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);

const outputPath = config.output_path
  ? path.resolve(configDir, config.output_path)
  : path.join(repoRoot, "data", "rl", "combat", "train.jsonl");

const scenarioPaths = resolveScenarioPaths(config, configDir);
const scenarios = scenarioPaths.map(p => {
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  assertScenarioV2(parsed, p);
  return {
    ...parsed,
    __scenario_name: path.basename(p, ".json"),
    __scenario_source_path: p,
  };
});

if (scenarios.length === 0) {
  throw new Error("No scenario files resolved for collector run");
}

const seeds = Array.isArray(config.seeds) && config.seeds.length > 0
  ? config.seeds.map(String)
  : [null];
const episodesPerSeed = Number.isInteger(config.episodes_per_seed) ? config.episodes_per_seed : 1;
const maxStepsPerEpisode = Number.isInteger(config.max_steps_per_episode) ? config.max_steps_per_episode : 64;
const policy = config.policy ?? { type: "random", epsilon: 1.0 };
const testTimeoutMs = Number.isInteger(config.test_timeout_ms) && config.test_timeout_ms > 0
  ? config.test_timeout_ms
  : 120000;
const rewardSwitchPenalty = Number.isFinite(config.reward_switch_penalty)
  ? Number(config.reward_switch_penalty)
  : -0.05;
const rewardStepPenalty = Number.isFinite(config.reward_step_penalty)
  ? Number(config.reward_step_penalty)
  : -0.05;
const rewardConsecutiveSwitchPenalty = Number.isFinite(config.reward_consecutive_switch_penalty)
  ? Number(config.reward_consecutive_switch_penalty)
  : -0.25;
const rewardDirectBackswitchPenalty = Number.isFinite(config.reward_direct_backswitch_penalty)
  ? Number(config.reward_direct_backswitch_penalty)
  : -0.35;
const rewardConsecutiveSwitchPenaltyScale = Number.isFinite(config.reward_consecutive_switch_penalty_scale)
  ? Number(config.reward_consecutive_switch_penalty_scale)
  : -0.15;
const rewardEnemyTeamHpDamageScale = Number.isFinite(config.reward_enemy_team_hp_damage_scale)
  ? Number(config.reward_enemy_team_hp_damage_scale)
  : 2.0;
const rewardPlayerTeamHpLossScale = Number.isFinite(config.reward_player_team_hp_loss_scale)
  ? Number(config.reward_player_team_hp_loss_scale)
  : -2.5;
const rewardEnemyFaintBonus = Number.isFinite(config.reward_enemy_faint_bonus)
  ? Number(config.reward_enemy_faint_bonus)
  : 1.5;
const rewardPlayerFaintPenalty = Number.isFinite(config.reward_player_faint_penalty)
  ? Number(config.reward_player_faint_penalty)
  : -4.0;
const rewardEnemyTeamDefeatBonus = Number.isFinite(config.reward_enemy_team_defeat_bonus)
  ? Number(config.reward_enemy_team_defeat_bonus)
  : 3.0;
const rewardPlayerTeamDefeatPenalty = Number.isFinite(config.reward_player_team_defeat_penalty)
  ? Number(config.reward_player_team_defeat_penalty)
  : -6.0;
const rewardAliveTeamMemberWinBonus = Number.isFinite(config.reward_alive_team_member_win_bonus)
  ? Number(config.reward_alive_team_member_win_bonus)
  : 1.0;
const rewardRemainingTeamHpRatioWinBonusScale = Number.isFinite(config.reward_remaining_team_hp_ratio_win_bonus_scale)
  ? Number(config.reward_remaining_team_hp_ratio_win_bonus_scale)
  : 2.0;
const terminalOnEggLapse = config.terminal_on_egg_lapse !== false;
const envProgressPauseEnabled = process.env.COLLECTOR_PROGRESS_PAUSE === "1";
const envProgressPauseTargetTransitions = Number.parseInt(process.env.COLLECTOR_PROGRESS_TARGET ?? "", 10);
const envProgressPausePercentStep = Number.parseInt(process.env.COLLECTOR_PROGRESS_STEP ?? "", 10);
const envProgressPauseMs = Number.parseInt(process.env.COLLECTOR_PROGRESS_PAUSE_MS ?? "", 10);
const progressPauseEnabled = config.progress_pause_enabled === true || envProgressPauseEnabled;
const progressPauseTargetTransitions = Number.isInteger(envProgressPauseTargetTransitions) && envProgressPauseTargetTransitions > 0
  ? envProgressPauseTargetTransitions
  : Number.isInteger(config.progress_pause_target_transitions) && config.progress_pause_target_transitions > 0
  ? config.progress_pause_target_transitions
  : 0;
const progressPausePercentStep = Number.isInteger(envProgressPausePercentStep) && envProgressPausePercentStep > 0
  ? envProgressPausePercentStep
  : Number.isInteger(config.progress_pause_percent_step) && config.progress_pause_percent_step > 0
  ? config.progress_pause_percent_step
  : 10;
const progressPauseMs = Number.isInteger(envProgressPauseMs) && envProgressPauseMs >= 0
  ? envProgressPauseMs
  : Number.isInteger(config.progress_pause_ms) && config.progress_pause_ms >= 0
  ? config.progress_pause_ms
  : 4000;
const appendOutput = config.append_output !== false;
const episodeIndexOffset = Number.isInteger(config.episode_index_offset) && config.episode_index_offset >= 0
  ? config.episode_index_offset
  : 0;
const stateVariants = Array.isArray(config.state_variants) && config.state_variants.length > 0
  ? config.state_variants.map(String)
  : [];
const quietGameLogs = config.quiet_game_logs === true || process.env.COLLECTOR_QUIET_GAME_LOGS === "1";
const plannedEpisodes = scenarios.length * seeds.length * episodesPerSeed;

mkdirSync(path.dirname(outputPath), { recursive: true });
if (!appendOutput && existsSync(outputPath)) {
  unlinkSync(outputPath);
}

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { spawn, spawnSync as spawnSyncChild } from "node:child_process";
import { getGameMode } from "#app/game-mode";
import overrides from "#app/overrides";
import { allAbilities } from "#data/data-lists";
import { BattleStyle } from "#enums/battle-style";
import { BattleType } from "#enums/battle-type";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { GameModes } from "#enums/game-modes";
import { MoveUseMode } from "#enums/move-use-mode";
import { MoveCategory } from "#enums/move-category";
import { Nature } from "#enums/nature";
import { Stat } from "#enums/stat";
import { StatusEffect } from "#enums/status-effect";
import { TrainerSlot } from "#enums/trainer-slot";
import { TrainerType } from "#enums/trainer-type";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { EncounterPhase } from "#phases/encounter-phase";
import { SelectStarterPhase } from "#phases/select-starter-phase";
import { PartyUiMode } from "#ui/party-ui-handler";
import { getPokemonSpecies } from "#utils/pokemon-utils";
import { GameManager } from "#test/test-utils/game-manager";
import { generateStarters } from "#test/test-utils/game-manager-utils";
import { afterAll, beforeAll, describe, it } from "vitest";

const SCENARIOS = ${JSON.stringify(scenarios)};
const SEEDS = ${JSON.stringify(seeds)};
const EPISODES_PER_SEED = ${episodesPerSeed};
const MAX_STEPS_PER_EPISODE = ${maxStepsPerEpisode};
const POLICY = ${JSON.stringify(policy)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};
const TEST_TIMEOUT_MS = ${testTimeoutMs};
const EPISODE_INDEX_OFFSET = ${episodeIndexOffset};
const REWARD_SWITCH_PENALTY = ${rewardSwitchPenalty};
const REWARD_STEP_PENALTY = ${rewardStepPenalty};
const REWARD_CONSECUTIVE_SWITCH_PENALTY = ${rewardConsecutiveSwitchPenalty};
const REWARD_DIRECT_BACKSWITCH_PENALTY = ${rewardDirectBackswitchPenalty};
const REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE = ${rewardConsecutiveSwitchPenaltyScale};
const REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE = ${rewardEnemyTeamHpDamageScale};
const REWARD_PLAYER_TEAM_HP_LOSS_SCALE = ${rewardPlayerTeamHpLossScale};
const REWARD_ENEMY_FAINT_BONUS = ${rewardEnemyFaintBonus};
const REWARD_PLAYER_FAINT_PENALTY = ${rewardPlayerFaintPenalty};
const REWARD_ENEMY_TEAM_DEFEAT_BONUS = ${rewardEnemyTeamDefeatBonus};
const REWARD_PLAYER_TEAM_DEFEAT_PENALTY = ${rewardPlayerTeamDefeatPenalty};
const REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS = ${rewardAliveTeamMemberWinBonus};
const REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE = ${rewardRemainingTeamHpRatioWinBonusScale};
const TERMINAL_ON_EGG_LAPSE = ${terminalOnEggLapse};
const PROGRESS_PAUSE_ENABLED = ${progressPauseEnabled};
const PROGRESS_PAUSE_TARGET_TRANSITIONS = ${progressPauseTargetTransitions};
const PROGRESS_PAUSE_PERCENT_STEP = ${progressPausePercentStep};
const PROGRESS_PAUSE_MS = ${progressPauseMs};
const STATE_VARIANTS = ${JSON.stringify(stateVariants)};
const QUIET_GAME_LOGS = ${quietGameLogs};
const PLANNED_EPISODES = ${plannedEpisodes};
const STEP_TIMEOUT_MS = Number.isFinite(POLICY.step_timeout_ms) && POLICY.step_timeout_ms > 0
  ? POLICY.step_timeout_ms
  : 15000;
const MOVE_ACTIONS = 4;
const SWITCH_ACTIONS = 6;
const ACTION_DIM = MOVE_ACTIONS + SWITCH_ACTIONS;
const CRITICAL_HP_RATIO = 0.1;
const persistentExternalPolicyWorkers = new Map<string, any>();
const HALF_HP_RATIO = 0.5;
const RAW_CONSOLE_LOG = console.log.bind(console);

function shouldSuppressGameLog(args: unknown[]): boolean {
  const joined = args
    .map(value => typeof value === "string" ? value : JSON.stringify(value))
    .join(" ")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trimStart();

  const noisyPrefixes = [
    "Start Phase ",
    "setMode ",
    "Move Pool:",
    "Move Scores:",
    "Sorted Move Pool:",
    "Chosen Move:",
    "Move:",
    "Player Pokemon:",
    "Pokemon:",
    "Stats (IVs):",
    "Ability:",
    "Moveset:",
    "crit stage:",
    "base damage",
    "damage ",
    "COMMON",
    "UNCOMMON",
    "RARE",
    "EPIC",
    "TACKLE NORMAL",
    "ASTONISH NORMAL",
    "use seasonal splash messages",
  ];

  return noisyPrefixes.some(prefix => joined.startsWith(prefix));
}

if (QUIET_GAME_LOGS) {
  console.log = (...args: unknown[]) => {
    if (shouldSuppressGameLog(args)) {
      return;
    }
    RAW_CONSOLE_LOG(...args);
  };
}

function getHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function bucketByThresholds(value: number, thresholds: number[]): number {
  for (let idx = 0; idx < thresholds.length; idx += 1) {
    if (value <= thresholds[idx]) {
      return idx;
    }
  }
  return thresholds.length;
}

function hpBucket(hpRatio: number): number {
  return bucketByThresholds(hpRatio, [0.05, 0.2, 0.4, 0.6, 0.8]);
}

function hpDiffBucket(diff: number): number {
  return bucketByThresholds(diff, [-0.6, -0.25, -0.1, 0.1, 0.25, 0.6]);
}

function levelGapBucket(levelGap: number): number {
  return bucketByThresholds(levelGap, [-15, -7, -2, 2, 7, 15]);
}

function powerBucket(power: number): number {
  if (power <= 0) return 0;
  if (power <= 40) return 1;
  if (power <= 70) return 2;
  if (power <= 100) return 3;
  return 4;
}

function effectivenessBucket(effectiveness: number): number {
  if (effectiveness <= 0) return 0;
  if (effectiveness <= 0.5) return 1;
  if (effectiveness <= 1.0) return 2;
  if (effectiveness <= 2.0) return 3;
  return 4;
}

function countBucket(value: number): number {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value <= 3) return 2;
  return 3;
}

function damageClassBucket(category: number): number {
  if (category === MoveCategory.PHYSICAL) return 0;
  if (category === MoveCategory.SPECIAL) return 1;
  return 2;
}

function moveKindBucket(moveData: any): number {
  const category = moveData?.category;
  const power = Number.isFinite(moveData?.power) ? moveData.power : 0;
  const priority = Number.isFinite(moveData?.priority) ? moveData.priority : 0;
  if (category === MoveCategory.STATUS || power <= 0) return 0;
  if (priority > 0) return 2;
  return 1;
}

function priorityBucket(priority: number): number {
  if (priority < 0) return 0;
  if (priority === 0) return 1;
  return 2;
}

function damageRatioBucket(damageRatio: number): number {
  if (damageRatio <= 0) return 0;
  if (damageRatio < 0.25) return 1;
  if (damageRatio < 0.5) return 2;
  if (damageRatio < 1.0) return 3;
  return 4;
}

function koTurnsBucket(damageRatio: number, targetHpRatio: number): number {
  if (damageRatio <= 0 || targetHpRatio <= 0) return 0;
  if (damageRatio >= targetHpRatio) return 1;
  if ((damageRatio * 2) >= targetHpRatio) return 2;
  return 3;
}

function accuracyBucket(accuracy: number): number {
  if (accuracy <= 0) return 0;
  if (accuracy < 75) return 1;
  if (accuracy < 90) return 2;
  return 3;
}

function getEffectiveSpeed(pokemon: any, opponent: any): number {
  if (typeof pokemon?.getEffectiveStat === "function") {
    const speed = pokemon.getEffectiveStat(Stat.SPD, opponent);
    if (Number.isFinite(speed)) {
      return speed;
    }
  }
  if (typeof pokemon?.getStat === "function") {
    const speed = pokemon.getStat(Stat.SPD, false);
    if (Number.isFinite(speed)) {
      return speed;
    }
  }
  return 0;
}

function speedOrderAdvantage(player: any, enemy: any): number {
  const playerSpeed = getEffectiveSpeed(player, enemy);
  const enemySpeed = getEffectiveSpeed(enemy, player);
  if (playerSpeed > enemySpeed) return 2;
  if (playerSpeed < enemySpeed) return 0;
  return 1;
}

function getBestKnownEnemyPriority(enemy: any): number {
  return enemy.getMoveset()
    .slice(0, 4)
    .reduce((best: number, move: any) => {
      const moveData = move.getMove?.();
      const ppMax = typeof move.getMovePp === "function" ? move.getMovePp() : 0;
      const ppUsed = Number.isFinite(move?.ppUsed) ? move.ppUsed : 0;
      const ppLeft = Math.max(0, ppMax - ppUsed);
      const priority = Number.isFinite(moveData?.priority) ? moveData.priority : 0;
      return ppLeft > 0 ? Math.max(best, priority) : best;
    }, 0);
}

function enemyHasKnownPriorityThreat(enemy: any): boolean {
  return getBestKnownEnemyPriority(enemy) > 0;
}

function actsFirstIfUsed(player: any, enemy: any, moveData: any, bestEnemyPriority: number): boolean {
  const priority = Number.isFinite(moveData?.priority) ? moveData.priority : 0;
  if (priority > bestEnemyPriority) return true;
  if (priority < bestEnemyPriority) return false;
  return getEffectiveSpeed(player, enemy) > getEffectiveSpeed(enemy, player);
}

function estimateDamageRatio(user: any, target: any, moveData: any, effectiveness: number, stab: number): number {
  const power = Number.isFinite(moveData?.power) ? moveData.power : 0;
  if (power <= 0 || moveData?.category === MoveCategory.STATUS || !Number.isFinite(effectiveness) || effectiveness <= 0) {
    return 0;
  }

  const attackStat = moveData?.category === MoveCategory.SPECIAL
    ? user.getEffectiveStat(Stat.SPATK, target)
    : user.getEffectiveStat(Stat.ATK, target);
  const defenseStatRaw = moveData?.category === MoveCategory.SPECIAL
    ? target.getEffectiveStat(Stat.SPDEF, user)
    : target.getEffectiveStat(Stat.DEF, user);
  const defenseStat = Math.max(1, Number.isFinite(defenseStatRaw) ? defenseStatRaw : 1);
  const level = Math.max(1, Number.isFinite(user?.level) ? user.level : 1);

  const estimated = (((2 * level) / 5 + 2) * power * (attackStat / defenseStat)) / 50;
  const accuracy = Number.isFinite(moveData?.accuracy) ? Math.max(1, Math.min(100, moveData.accuracy)) / 100 : 1;
  const modifier = effectiveness * (stab ? 1.5 : 1.0) * accuracy;
  const targetMaxHp = Math.max(1, typeof target.getMaxHp === "function" ? target.getMaxHp() : 1);
  return Math.max(0, (estimated * modifier) / targetMaxHp);
}

function usesBestOffenseStat(user: any, target: any, moveData: any): boolean {
  if (moveData?.category === MoveCategory.STATUS) {
    return false;
  }
  const attack = user.getEffectiveStat(Stat.ATK, target);
  const specialAttack = user.getEffectiveStat(Stat.SPATK, target);
  if (moveData?.category === MoveCategory.PHYSICAL) {
    return attack >= specialAttack;
  }
  return specialAttack >= attack;
}

function assertScenarioV2(scenario: any, sourcePath: string): void {
  const hasSource = scenario?.source != null;
  const hasWaveIndex = Number.isInteger(scenario?.wave_index);
  const hasBattleType = typeof scenario?.battle_type === "string" && scenario.battle_type.length > 0;
  const hasBattleSpec = typeof scenario?.battle_spec === "string" && scenario.battle_spec.length > 0;
  const hasBattleStyle = typeof scenario?.battle_style === "string" && scenario.battle_style.length > 0;
  const hasDoubleFlag = typeof scenario?.is_double_fight === "boolean";
  const hasPlayerTeam = Array.isArray(scenario?.player_team) && scenario.player_team.length > 0;
  const hasEnemyTeam = Array.isArray(scenario?.enemy_team) && scenario.enemy_team.length > 0;

  if (hasSource && hasWaveIndex && hasBattleType && hasBattleSpec && hasBattleStyle && hasDoubleFlag && hasPlayerTeam && hasEnemyTeam) {
    return;
  }

  throw new Error(
    "Collector requires combat-scenario-v2 input. Invalid scenario: "
    + sourcePath
    + " (expected source, wave_index, battle_type, battle_spec, battle_style, is_double_fight, player_team, enemy_team)",
  );
}

function getScenarioWaveIndex(scenario: any): number {
  return Number(scenario.wave_index);
}

function getScenarioBattleTypeName(scenario: any): string {
  if (typeof scenario?.battle_type === "string" && scenario.battle_type.length > 0) {
    return scenario.battle_type.toUpperCase();
  }
  return "WILD";
}

function mapBattleTypeName(value: string): BattleType {
  if (value === "TRAINER") {
    return BattleType.TRAINER;
  }
  return BattleType.WILD;
}

function mapBattleStyleName(value: unknown): BattleStyle | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.toUpperCase();
  if (normalized === "SET") {
    return BattleStyle.SET;
  }
  if (normalized === "SWITCH") {
    return BattleStyle.SWITCH;
  }
  return null;
}

function mapTrainerTypeName(value: unknown): TrainerType | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const trainerType = TrainerType[value as keyof typeof TrainerType];
  return Number.isInteger(trainerType) ? trainerType as TrainerType : null;
}

function inferScenarioTrainerBattle(scenario: any): boolean {
  const battleType = typeof scenario?.battle_type === "string"
    ? scenario.battle_type.toLowerCase()
    : "";
  if (battleType === "trainer") {
    return true;
  }

  return scenario?.trainer != null;
}

function setPokemonHpRatio(pokemon: any, ratio: number) {
  if (!pokemon || !Number.isFinite(ratio)) {
    return;
  }
  const maxHp = pokemon.getMaxHp();
  if (!Number.isFinite(maxHp) || maxHp <= 0) {
    return;
  }
  let nextHp = Math.round(maxHp * ratio);
  if (ratio > 0 && nextHp <= 0) {
    nextHp = 1;
  }
  pokemon.hp = Math.max(0, Math.min(maxHp, nextHp));
}

function setPokemonHpAbsolute(pokemon: any, hp: number) {
  if (!pokemon || !Number.isFinite(hp)) {
    return;
  }
  const maxHp = pokemon.getMaxHp();
  if (!Number.isFinite(maxHp) || maxHp <= 0) {
    return;
  }
  const nextHp = Math.max(0, Math.min(maxHp, Math.round(hp)));
  pokemon.hp = nextHp;
}

function applyScenarioMaterializedState(game: GameManager, scenario: any) {
  const playerParty = game.scene.getPlayerParty();
  const enemyParty = Array.isArray(game.scene.currentBattle?.enemyParty)
    ? game.scene.currentBattle.enemyParty
    : [];
  const scenarioPlayerTeam = Array.isArray(scenario.player_team) ? scenario.player_team : [];
  const scenarioEnemyTeam = Array.isArray(scenario.enemy_team) ? scenario.enemy_team : [];

  if (playerParty.length < scenarioPlayerTeam.length) {
    throw new Error("Scenario player_team exceeds initialized player party size");
  }
  if (enemyParty.length < scenarioEnemyTeam.length) {
    throw new Error("Scenario enemy_team exceeds initialized enemy party size");
  }

  const activePlayerSlots = scenarioPlayerTeam
    .map((member: any, index: number) => member?.is_on_field === true ? index : -1)
    .filter((index: number) => index >= 0);
  const activeEnemySlots = scenarioEnemyTeam
    .map((member: any, index: number) => member?.is_on_field === true ? index : -1)
    .filter((index: number) => index >= 0);

  if (activePlayerSlots.length !== 1 || activePlayerSlots[0] !== 0) {
    throw new Error("V2 collector currently requires player active slot 0 in single battles");
  }
  if (activeEnemySlots.length !== 1 || activeEnemySlots[0] !== 0) {
    throw new Error("V2 collector currently requires enemy active slot 0 in single battles");
  }

  for (let idx = 0; idx < scenarioPlayerTeam.length; idx += 1) {
    patchPokemonFromScenario(playerParty[idx], scenarioPlayerTeam[idx], true);
  }
  for (let idx = 0; idx < scenarioEnemyTeam.length; idx += 1) {
    patchPokemonFromScenario(enemyParty[idx], scenarioEnemyTeam[idx], false);
  }
}

function buildEnemyPokemonFromScenario(game: GameManager, member: any) {
  const species = getPokemonSpecies(Number(member.species_id));
  const level = Number(member.level);
  const enemyPokemon = game.scene.addEnemyPokemon(
    species,
    level,
    TrainerSlot.TRAINER,
    member?.is_boss === true,
  );
  patchPokemonFromScenario(enemyPokemon, member, false);
  return enemyPokemon;
}

function prepareScenarioBattleBeforeEncounter(game: GameManager, scenario: any) {
  const battle = game.scene.currentBattle as any;
  if (!battle) {
    throw new Error("Missing current battle before EncounterPhase");
  }

  const playerParty = game.scene.getPlayerParty();
  const scenarioPlayerTeam = Array.isArray(scenario.player_team) ? scenario.player_team : [];
  if (playerParty.length < scenarioPlayerTeam.length) {
    throw new Error("Scenario player_team exceeds initialized player party size before EncounterPhase");
  }
  for (let idx = 0; idx < scenarioPlayerTeam.length; idx += 1) {
    patchPokemonFromScenario(playerParty[idx], scenarioPlayerTeam[idx], true);
  }

  if (battle.battleType !== BattleType.TRAINER) {
    return;
  }

  const scenarioEnemyTeam = Array.isArray(scenario.enemy_team) ? scenario.enemy_team : [];
  if (scenarioEnemyTeam.length === 0) {
    throw new Error("Trainer scenario is missing enemy_team members");
  }
  if (!battle.trainer) {
    throw new Error("Trainer scenario reached EncounterPhase without trainer instance");
  }

  const scenarioTrainerType = mapTrainerTypeName(scenario.trainer?.trainer_type);
  if (scenarioTrainerType != null && battle.trainer.config?.trainerType !== scenarioTrainerType) {
    throw new Error(
      "Trainer type mismatch before EncounterPhase: expected "
      + String(scenario.trainer?.trainer_type)
      + ", got "
      + String(TrainerType[battle.trainer.config?.trainerType] ?? battle.trainer.config?.trainerType),
    );
  }

  battle.double = false;
  battle.enemyLevels = scenarioEnemyTeam.map((member: any) => Number(member.level));
  battle.enemyParty = [];
  battle.trainer.genPartyMember = ((index: number) => {
    const member = scenarioEnemyTeam[index];
    if (!member) {
      throw new Error("Missing scenario enemy_team member at index " + index);
    }
    return buildEnemyPokemonFromScenario(game, member);
  }) as typeof battle.trainer.genPartyMember;
}

function patchPokemonFromScenario(pokemon: any, member: any, player: boolean) {
  if (!pokemon || !member) {
    return;
  }

  pokemon.id = Number(member.id);
  pokemon.name = typeof member.name === "string" ? member.name : pokemon.name;
  pokemon.species = getPokemonSpecies(Number(member.species_id));
  pokemon.formIndex = Number.isInteger(member.form_index) ? Number(member.form_index) : 0;
  pokemon.level = Number(member.level);
  if (member.gender != null) {
    pokemon.gender = member.gender;
  }
  pokemon.ivs = toStatArray(member.ivs);

  const natureValue = typeof member.nature === "string"
    ? Nature[member.nature as keyof typeof Nature]
    : null;
  if (Number.isInteger(natureValue)) {
    pokemon.setNature(natureValue as Nature);
  }

  pokemon.passive = member.passive_ability_id != null;
  pokemon.shiny = member.is_shiny === true;
  pokemon.variant = pokemon.shiny ? (pokemon.variant ?? 0) : 0;
  pokemon.calculateStats();
  pokemon.hp = Number(member.hp);

  pokemon.moveset = [];
  if (Array.isArray(member.moveset)) {
    member.moveset.slice(0, 4).forEach((move: any, index: number) => {
      pokemon.setMove(index, Number(move.id));
      if (pokemon.moveset[index]) {
        pokemon.moveset[index].ppUsed = Number(move.pp_used ?? 0);
      }
    });
  }

  if (member.current_ability_id != null && allAbilities[Number(member.current_ability_id)]) {
    pokemon.setTempAbility(allAbilities[Number(member.current_ability_id)]);
  }
  if (member.passive_ability_id != null && allAbilities[Number(member.passive_ability_id)]) {
    pokemon.setTempAbility(allAbilities[Number(member.passive_ability_id)], true);
  }
  pokemon.summonData.abilitySuppressed = member.ability_suppressed === true;

  pokemon.summonData.statStages = Array.isArray(member.stat_stages)
    ? member.stat_stages.map((value: any) => Number(value))
    : [0, 0, 0, 0, 0, 0, 0];
  pokemon.summonData.stats = member.battle_stats != null
    ? toStatArray(member.battle_stats)
    : [0, 0, 0, 0, 0, 0];

  if (member.status?.effect) {
    const statusEffect = StatusEffect[member.status.effect as keyof typeof StatusEffect];
    if (Number.isInteger(statusEffect)) {
      if (statusEffect === StatusEffect.FAINT) {
        pokemon.hp = 0;
      }
      pokemon.doSetStatus(statusEffect as StatusEffect, Number(member.status.turnCount ?? 0));
    } else {
      pokemon.status = null;
    }
  } else {
    pokemon.status = null;
  }

  if (typeof pokemon.setBoss === "function") {
    if (!player && member.is_boss === true) {
      pokemon.setBoss(true, Number(member.boss_segments ?? 0));
    } else if (!player) {
      pokemon.setBoss(false, 0);
    }
  }
}

function toStatArray(stats: any): number[] {
  return [
    Number(stats?.hp ?? 0),
    Number(stats?.attack ?? 0),
    Number(stats?.defense ?? 0),
    Number(stats?.specialAttack ?? 0),
    Number(stats?.specialDefense ?? 0),
    Number(stats?.speed ?? 0),
  ];
}

function hashString(value: string): number {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = ((hash * 31) + value.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

function pickDeterministicBenchIndex(game: GameManager, token: string): number | null {
  const party = game.scene.getPlayerParty();
  const candidates = party
    .map((member, index) => ({ member, index }))
    .filter(entry => entry.index > 0 && !!entry.member);
  if (candidates.length === 0) {
    return null;
  }
  const selected = hashString(token) % candidates.length;
  return candidates[selected].index;
}

function applyStateVariant(game: GameManager, scenario: any, variantId: string | null, episodeToken: string) {
  if (!variantId) {
    return;
  }
  const party = game.scene.getPlayerParty();
  const enemy = game.scene.getEnemyPokemon();

  switch (variantId) {
    case "all_full":
      party.forEach(member => setPokemonHpRatio(member, 1.0));
      setPokemonHpRatio(enemy, 1.0);
      break;
    case "lead_critical_bench_full":
      party.forEach((member, index) => setPokemonHpRatio(member, index === 0 ? CRITICAL_HP_RATIO : 1.0));
      setPokemonHpRatio(enemy, 1.0);
      break;
    case "lead_1hp_bench_full":
      party.forEach((member, index) => {
        if (index === 0) {
          setPokemonHpAbsolute(member, 1);
          return;
        }
        setPokemonHpRatio(member, 1.0);
      });
      setPokemonHpRatio(enemy, 1.0);
      break;
    case "lead_critical_plus_random_bench_critical": {
      party.forEach(member => setPokemonHpRatio(member, 1.0));
      setPokemonHpRatio(enemy, 1.0);
      setPokemonHpRatio(party[0], CRITICAL_HP_RATIO);
      const benchIndex = pickDeterministicBenchIndex(game, episodeToken + "::random_bench");
      if (benchIndex != null) {
        setPokemonHpRatio(party[benchIndex], CRITICAL_HP_RATIO);
      }
      break;
    }
    case "all_critical":
      party.forEach(member => setPokemonHpRatio(member, CRITICAL_HP_RATIO));
      setPokemonHpRatio(enemy, 1.0);
      break;
    case "lead_half_bench_full":
      party.forEach((member, index) => setPokemonHpRatio(member, index === 0 ? HALF_HP_RATIO : 1.0));
      setPokemonHpRatio(enemy, 1.0);
      break;
    case "enemy_half":
      party.forEach(member => setPokemonHpRatio(member, 1.0));
      setPokemonHpRatio(enemy, HALF_HP_RATIO);
      break;
    case "enemy_critical":
      party.forEach(member => setPokemonHpRatio(member, 1.0));
      setPokemonHpRatio(enemy, CRITICAL_HP_RATIO);
      break;
    default:
      throw new Error("Unknown state variant: " + variantId);
  }
}

function selectEpisodeStateVariant(globalEpisodeIndex: number): string | null {
  if (!Array.isArray(STATE_VARIANTS) || STATE_VARIANTS.length === 0) {
    return null;
  }
  return STATE_VARIANTS[globalEpisodeIndex % STATE_VARIANTS.length];
}

function buildObservation(game: GameManager, scenario: any) {
  const player = game.scene.getPlayerPokemon();
  const enemy = game.scene.getEnemyPokemon();
  if (!player || !enemy) {
    throw new Error("Missing active battlers while building observation");
  }

  const playerTypes = player
    .getTypes(true, true)
    .filter(type => Number.isInteger(type) && type >= 0)
    .slice(0, 2);
  const enemyTypes = enemy
    .getTypes(true, true)
    .filter(type => Number.isInteger(type) && type >= 0)
    .slice(0, 2);

  const moveSet = player.getMoveset().slice(0, 4);
  const playerHpRatio = getHpRatio(player.hp, player.getMaxHp());
  const enemyHpRatio = getHpRatio(enemy.hp, enemy.getMaxHp());
  const speedAdvantage = speedOrderAdvantage(player, enemy);
  const knownEnemyPriorityThreat = enemyHasKnownPriorityThreat(enemy);
  const bestKnownEnemyPriority = getBestKnownEnemyPriority(enemy);
  const activeBestMoveEffectiveness = moveSet.reduce((best, move) => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    if (ppLeft <= 0) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    return Math.max(best, Number.isFinite(effectiveness) ? effectiveness : 1);
  }, 0);
  const activeBestDamageRatio = moveSet.reduce((best, move) => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    if (ppLeft <= 0) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const stab = playerTypes.includes(moveData.type) ? 1 : 0;
    return Math.max(best, estimateDamageRatio(player, enemy, moveData, effectiveness, stab));
  }, 0);
  const enemyBestDamageIntoActive = enemy.getMoveset().slice(0, 4).reduce((best, move) => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    if (ppLeft <= 0) return best;
    const effectiveness = player.getMoveEffectiveness(enemy, moveData, false, true);
    const enemyStab = enemyTypes.includes(moveData.type) ? 1 : 0;
    return Math.max(best, estimateDamageRatio(enemy, player, moveData, effectiveness, enemyStab));
  }, 0);
  const moves = player.getMoveset().slice(0, 4).map(move => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    const ppRatio = ppMax > 0 ? ppLeft / ppMax : 0;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const moveType = moveData.type;
    const stab = playerTypes.includes(moveType) ? 1 : 0;
    const available = ppLeft > 0 ? 1 : 0;
    const actsFirst = available === 1 && actsFirstIfUsed(player, enemy, moveData, bestKnownEnemyPriority);
    const estimatedDamageRatio = estimateDamageRatio(player, enemy, moveData, effectiveness, stab);
    return {
      available,
      power_bucket: powerBucket(Number.isFinite(moveData.power) ? moveData.power : 0),
      effectiveness_bucket: effectivenessBucket(Number.isFinite(effectiveness) ? effectiveness : 1),
      stab,
      pp_low: ppLeft > 0 && ppRatio <= 0.2 ? 1 : 0,
      priority_bucket: priorityBucket(Number.isFinite(moveData.priority) ? moveData.priority : 0),
      acts_first_if_used: actsFirst ? 1 : 0,
      can_ko_before_enemy_moves: actsFirst && estimatedDamageRatio >= enemyHpRatio ? 1 : 0,
      move_kind_bucket: moveKindBucket(moveData),
      damage_class_bucket: damageClassBucket(moveData.category),
      estimated_damage_ratio_bucket: damageRatioBucket(estimatedDamageRatio),
      estimated_ko_turns_bucket: koTurnsBucket(estimatedDamageRatio, enemyHpRatio),
      accuracy_bucket: accuracyBucket(Number.isFinite(moveData.accuracy) ? moveData.accuracy : 100),
      uses_best_offense_stat: usesBestOffenseStat(player, enemy, moveData) ? 1 : 0,
      target_immunity_risk: effectiveness <= 0 ? 1 : 0,
    };
  });
  const activeHasAnyFirstStrikeMove = moves.some(move => move.acts_first_if_used === 1);

  const actionMask = Array.from({ length: ACTION_DIM }, () => 0);
  for (let idx = 0; idx < moves.length; idx += 1) {
    actionMask[idx] = moves[idx].available;
  }

  const party = game.scene.getPlayerParty();
  const switchableMembers: Array<{
    hpRatio: number;
    bestEffectiveness: number;
    bestDamageIntoEnemy: number;
    expectedIncomingDamage: number;
    survivesOneHit: boolean;
  }> = [];
  const partySlots = Array.from({ length: 6 }, (_, slot) => {
    const member = party[slot];
    if (!member) {
      return {
        present: 0,
        active: 0,
        fainted: 0,
        hp_ratio: 0,
        level: 0,
        types: [],
        best_damage_into_enemy_bucket: 0,
        expected_incoming_damage_bucket: 0,
        speed_advantage_bucket: 1,
        survives_one_hit: 0,
        can_threaten_ko_bucket: 0,
      };
    }

    const hpRatio = getHpRatio(member.hp, member.getMaxHp());
    const types = member
      .getTypes(true, true)
      .filter(type => Number.isInteger(type) && type >= 0)
      .slice(0, 2);

    const canSwitch = !member.isOnField() && !member.isFainted() && member.isAllowedInBattle();
    const bestDamageIntoEnemy = member.getMoveset()
      .slice(0, 4)
      .reduce((best, move) => {
        const moveData = move.getMove();
        const ppMax = move.getMovePp();
        const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
        const ppLeft = Math.max(0, ppMax - ppUsed);
        if (ppLeft <= 0) return best;
        const effectiveness = enemy.getMoveEffectiveness(member, moveData, false, true);
        const memberTypes = member.getTypes(true, true)
          .filter(type => Number.isInteger(type) && type >= 0)
          .slice(0, 2);
        const stab = memberTypes.includes(moveData.type) ? 1 : 0;
        return Math.max(best, estimateDamageRatio(member, enemy, moveData, effectiveness, stab));
      }, 0);
    const expectedIncomingDamage = enemy.getMoveset()
      .slice(0, 4)
      .reduce((best, move) => {
        const moveData = move.getMove();
        const ppMax = move.getMovePp();
        const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
        const ppLeft = Math.max(0, ppMax - ppUsed);
        if (ppLeft <= 0) return best;
        const effectiveness = member.getMoveEffectiveness(enemy, moveData, false, true);
        const stab = enemyTypes.includes(moveData.type) ? 1 : 0;
        return Math.max(best, estimateDamageRatio(enemy, member, moveData, effectiveness, stab));
      }, 0);
    const slotSpeedAdvantage = speedOrderAdvantage(member, enemy);
    const survivesOneHit = expectedIncomingDamage < hpRatio;
    const canThreatenKoBucket = koTurnsBucket(bestDamageIntoEnemy, enemyHpRatio);
    actionMask[MOVE_ACTIONS + slot] = canSwitch ? 1 : 0;
    if (canSwitch) {
      const bestEffectiveness = member.getMoveset()
        .slice(0, 4)
        .reduce((best, move) => {
          const moveData = move.getMove();
          const ppMax = move.getMovePp();
          const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
          const ppLeft = Math.max(0, ppMax - ppUsed);
          if (ppLeft <= 0) return best;
          const effectiveness = enemy.getMoveEffectiveness(member, moveData, false, true);
          return Math.max(best, Number.isFinite(effectiveness) ? effectiveness : 1);
        }, 0);
      switchableMembers.push({
        hpRatio,
        bestEffectiveness,
        bestDamageIntoEnemy,
        expectedIncomingDamage,
        survivesOneHit,
      });
    }

    return {
      present: 1,
      active: member.isOnField() ? 1 : 0,
      fainted: member.isFainted() ? 1 : 0,
      hp_ratio: hpRatio,
      level: member.level,
      types,
      best_damage_into_enemy_bucket: damageRatioBucket(bestDamageIntoEnemy),
      expected_incoming_damage_bucket: damageRatioBucket(expectedIncomingDamage),
      speed_advantage_bucket: slotSpeedAdvantage,
      survives_one_hit: survivesOneHit ? 1 : 0,
      can_threaten_ko_bucket: canThreatenKoBucket,
    };
  });
  const aliveBenchCount = switchableMembers.length;
  const healthyBenchCount = switchableMembers.filter(member => member.hpRatio > 0.5).length;
  const bestSwitchEffectiveness = switchableMembers.reduce((best, member) => Math.max(best, member.bestEffectiveness), 0);
  const lowestSwitchHp = switchableMembers.length > 0
    ? switchableMembers.reduce((lowest, member) => Math.min(lowest, member.hpRatio), 1)
    : 1;
  const worstSwitchRiskBucket = switchableMembers.length === 0
    ? 0
    : lowestSwitchHp <= 0.25 ? 3 : lowestSwitchHp <= 0.5 ? 2 : lowestSwitchHp <= 0.75 ? 1 : 0;
  const battle = game.scene.currentBattle as any;
  const isTrainerBattle = battle?.trainer != null || inferScenarioTrainerBattle(scenario);
  const hasLegalSwitch = aliveBenchCount > 0;
  const activeHpCritical = playerHpRatio <= 0.25;
  const benchHasHealthierSwitch = switchableMembers.some(member => member.hpRatio > playerHpRatio + 0.15);
  const benchHasBetterMatchupThanActive = bestSwitchEffectiveness > activeBestMoveEffectiveness;
  const activeCanFinishEnemy = enemyHpRatio <= 0.25 && activeBestMoveEffectiveness >= 1.0;

  return {
    wave_index: game.scene.currentBattle.waveIndex,
    player_hp_ratio: playerHpRatio,
    enemy_hp_ratio: enemyHpRatio,
    player_hp_bucket: hpBucket(playerHpRatio),
    enemy_hp_bucket: hpBucket(enemyHpRatio),
    hp_diff_bucket: hpDiffBucket(playerHpRatio - enemyHpRatio),
    level_gap_bucket: levelGapBucket(player.level - enemy.level),
    is_trainer_battle: isTrainerBattle ? 1 : 0,
    has_legal_switch: hasLegalSwitch ? 1 : 0,
    active_hp_critical: activeHpCritical ? 1 : 0,
    bench_has_healthier_switch: benchHasHealthierSwitch ? 1 : 0,
    bench_has_better_matchup_than_active: benchHasBetterMatchupThanActive ? 1 : 0,
    active_can_finish_enemy: activeCanFinishEnemy ? 1 : 0,
    alive_bench_count_bucket: countBucket(aliveBenchCount),
    healthy_bench_count_bucket: countBucket(healthyBenchCount),
    best_switch_matchup_bucket: effectivenessBucket(bestSwitchEffectiveness),
    worst_switch_risk_bucket: worstSwitchRiskBucket,
    speed_order_advantage: speedAdvantage,
    enemy_has_known_priority_threat: knownEnemyPriorityThreat ? 1 : 0,
    active_has_any_first_strike_move: activeHasAnyFirstStrikeMove ? 1 : 0,
    active_best_damage_bucket: damageRatioBucket(activeBestDamageRatio),
    enemy_best_damage_into_active_bucket: damageRatioBucket(enemyBestDamageIntoActive),
    active_survives_next_hit: enemyBestDamageIntoActive < playerHpRatio ? 1 : 0,
    enemy_survives_best_hit: activeBestDamageRatio < enemyHpRatio ? 1 : 0,
    moves,
    party_slots: partySlots,
    action_mask: actionMask,
  };
}

function getPlayerTeamHpRatio(game: GameManager): number {
  const party = game.scene.getPlayerParty();
  let totalHp = 0;
  let totalMaxHp = 0;

  for (const member of party) {
    if (!member || typeof member.getMaxHp !== "function") {
      continue;
    }
    const maxHp = member.getMaxHp();
    if (!Number.isFinite(maxHp) || maxHp <= 0) {
      continue;
    }
    totalHp += Math.max(0, Number.isFinite(member.hp) ? member.hp : 0);
    totalMaxHp += maxHp;
  }

  if (totalMaxHp <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, totalHp / totalMaxHp));
}

function getEnemyTeamHpRatio(game: GameManager): number {
  const battle = game.scene.currentBattle as any;
  const enemyParty = Array.isArray(battle?.enemyParty) ? battle.enemyParty : [];
  let totalHp = 0;
  let totalMaxHp = 0;

  for (const member of enemyParty) {
    if (!member || typeof member.getMaxHp !== "function") {
      continue;
    }
    const maxHp = member.getMaxHp();
    if (!Number.isFinite(maxHp) || maxHp <= 0) {
      continue;
    }
    totalHp += Math.max(0, Number.isFinite(member.hp) ? member.hp : 0);
    totalMaxHp += maxHp;
  }

  if (totalMaxHp <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, totalHp / totalMaxHp));
}

function countAlivePlayerTeamMembers(game: GameManager): number {
  return game.scene
    .getPlayerParty()
    .filter(member => !!member && !member.isFainted() && member.isAllowedInBattle())
    .length;
}

function findActivePartySlotIndex(observation: any): number {
  const partySlots = Array.isArray(observation?.party_slots) ? observation.party_slots : [];
  for (let idx = 0; idx < partySlots.length; idx += 1) {
    if (partySlots[idx]?.active === 1) {
      return idx;
    }
  }
  return -1;
}

function deriveTerminalNextState(state: any, enemyTeamDefeated: boolean, playerTeamDefeated: boolean) {
  const terminalMask = Array.from({ length: ACTION_DIM }, () => 0);
  return {
    ...state,
    player_hp_ratio: playerTeamDefeated ? 0 : state.player_hp_ratio,
    enemy_hp_ratio: enemyTeamDefeated ? 0 : state.enemy_hp_ratio,
    player_hp_bucket: playerTeamDefeated ? 0 : state.player_hp_bucket,
    enemy_hp_bucket: enemyTeamDefeated ? 0 : state.enemy_hp_bucket,
    action_mask: terminalMask,
  };
}

function selectMoveByIndex(game: GameManager, actionIndex: number) {
  game.onNextPrompt("CommandPhase", UiMode.COMMAND, () => {
    game.scene.ui.setMode(
      UiMode.FIGHT,
      (game.scene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex(),
    );
  });

  game.onNextPrompt("CommandPhase", UiMode.FIGHT, () => {
    (game.scene.phaseManager.getCurrentPhase() as CommandPhase).handleCommand(
      Command.FIGHT,
      actionIndex,
      MoveUseMode.NORMAL,
    );
  });

  game.selectTarget(actionIndex, BattlerIndex.ENEMY);
}

function selectSwitchByPartyIndex(game: GameManager, partyIndex: number) {
  game.doSwitchPokemon(partyIndex);
}

function computeScheduledEpsilonForPolicy(policyConfig: any, globalEpisodeIndex: number): number {
  if (policyConfig?.type !== "epsilon_random") {
    return Number.isFinite(policyConfig?.epsilon) ? policyConfig.epsilon : 1.0;
  }

  const start = Number.isFinite(policyConfig?.start_epsilon) ? policyConfig.start_epsilon : 1.0;
  const end = Number.isFinite(policyConfig?.end_epsilon) ? policyConfig.end_epsilon : 0.05;
  const decayFraction = Number.isFinite(policyConfig?.decay_fraction) && policyConfig.decay_fraction > 0
    ? Number(policyConfig.decay_fraction)
    : null;
  const decayEpisodes = decayFraction != null
    ? Math.max(1, Math.round(PLANNED_EPISODES * Math.min(1, decayFraction)))
    : Number.isFinite(policyConfig?.decay_episodes) && policyConfig.decay_episodes > 0
    ? policyConfig.decay_episodes
    : 100;

  const progress = Math.max(0, Math.min(1, globalEpisodeIndex / decayEpisodes));
  return start + (end - start) * progress;
}

function sampleUniformAction(valid: number[]): number {
  return valid[Math.floor(Math.random() * valid.length)];
}

function externalPolicyKey(policyConfig: any): string {
  return JSON.stringify({
    command: Array.isArray(policyConfig?.command) ? policyConfig.command : [],
    env: typeof policyConfig?.env === "object" && policyConfig.env !== null ? policyConfig.env : {},
    timeout_ms: Number.isFinite(policyConfig?.timeout_ms) ? policyConfig.timeout_ms : null,
    persistent: policyConfig?.persistent === true,
  });
}

function describeWorkerStderr(worker: any): string {
  if (!Array.isArray(worker?.stderrChunks) || worker.stderrChunks.length === 0) {
    return "";
  }
  return worker.stderrChunks.join("");
}

function cleanupPersistentExternalPolicyWorkers(): void {
  for (const worker of persistentExternalPolicyWorkers.values()) {
    if (Array.isArray(worker?.pending)) {
      for (const pending of worker.pending) {
        pending.reject(new Error("Persistent external policy worker was cleaned up"));
      }
      worker.pending.length = 0;
    }
    try {
      worker?.readline?.close?.();
    } catch {
      // Best-effort.
    }
    try {
      worker?.child?.stdin?.end?.();
    } catch {
      // Best-effort.
    }
    try {
      worker?.child?.kill?.("SIGTERM");
    } catch {
      // Best-effort.
    }
  }
  persistentExternalPolicyWorkers.clear();
}

function getOrStartPersistentExternalPolicyWorker(policyConfig: any): any {
  const key = externalPolicyKey(policyConfig);
  const existing = persistentExternalPolicyWorkers.get(key);
  if (existing) {
    return existing;
  }

  if (!Array.isArray(policyConfig?.command) || policyConfig.command.length === 0) {
    throw new Error("POLICY.command must be a non-empty string array for external_command");
  }

  const [command, ...args] = policyConfig.command;
  const env = typeof policyConfig?.env === "object" && policyConfig.env !== null
    ? { ...process.env, ...policyConfig.env }
    : process.env;
  const child = spawn(command, args, {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const worker = {
    key,
    child,
    pending: [] as Array<{ resolve: (action: number) => void; reject: (error: Error) => void }>,
    stderrChunks: [] as string[],
    readline: createInterface({ input: child.stdout }),
  };

  worker.readline.on("line", (line: string) => {
    const pending = worker.pending.shift();
    if (!pending) {
      return;
    }
    try {
      const parsed = JSON.parse(line);
      const action = parsed?.action;
      if (Number.isInteger(action)) {
        pending.resolve(action);
        return;
      }
      const errorMessage = typeof parsed?.error === "string"
        ? parsed.error
        : "Persistent external policy response did not contain an integer action";
      pending.reject(new Error(errorMessage));
    } catch (error) {
      pending.reject(new Error("Failed to parse persistent external policy response: " + String(error)));
    }
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    const text = String(chunk);
    worker.stderrChunks.push(text);
    if (worker.stderrChunks.length > 20) {
      worker.stderrChunks.shift();
    }
  });

  const rejectAllPending = (reason: string) => {
    while (worker.pending.length > 0) {
      worker.pending.shift()?.reject(new Error(reason + describeWorkerStderr(worker)));
    }
  };

  child.on("error", (error: Error) => {
    persistentExternalPolicyWorkers.delete(key);
    rejectAllPending("Persistent external policy worker failed: " + String(error) + " ");
  });

  child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    persistentExternalPolicyWorkers.delete(key);
    if (worker.pending.length > 0) {
      rejectAllPending(
        "Persistent external policy worker exited unexpectedly"
          + " code=" + String(code)
          + " signal=" + String(signal)
          + " ",
      );
    }
  });

  persistentExternalPolicyWorkers.set(key, worker);
  return worker;
}

async function runPersistentExternalPolicy(policyConfig: any, state: any, actionMask: number[]): Promise<number> {
  const worker = getOrStartPersistentExternalPolicyWorker(policyConfig);
  const timeoutMs = Number.isFinite(policyConfig?.timeout_ms) && policyConfig.timeout_ms > 0
    ? policyConfig.timeout_ms
    : 5000;
  const payload = JSON.stringify({ state, action_mask: actionMask }) + "\\n";

  return await withTimeout(
    new Promise<number>((resolve, reject) => {
      worker.pending.push({ resolve, reject });
      worker.child.stdin.write(payload, "utf8", (error: Error | null | undefined) => {
        if (!error) {
          return;
        }
        const pendingIndex = worker.pending.findIndex((entry: any) => entry.resolve === resolve);
        if (pendingIndex >= 0) {
          worker.pending.splice(pendingIndex, 1);
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    }),
    timeoutMs,
    "persistent external policy",
  );
}

async function runExternalPolicy(policyConfig: any, state: any, actionMask: number[]): Promise<number> {
  if (policyConfig?.persistent === true) {
    return runPersistentExternalPolicy(policyConfig, state, actionMask);
  }

  if (!Array.isArray(policyConfig?.command) || policyConfig.command.length === 0) {
    throw new Error("POLICY.command must be a non-empty string array for external_command");
  }

  const [command, ...args] = policyConfig.command;
  const timeoutMs = Number.isFinite(policyConfig?.timeout_ms) && policyConfig.timeout_ms > 0
    ? policyConfig.timeout_ms
    : 5000;
  const env = typeof policyConfig?.env === "object" && policyConfig.env !== null
    ? { ...process.env, ...policyConfig.env }
    : process.env;
  const result = spawnSyncChild(command, args, {
    input: JSON.stringify({ state, action_mask: actionMask }),
    encoding: "utf8",
    env,
    timeout: timeoutMs,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      "External policy command failed with status " + result.status + ": " + (result.stderr ?? ""),
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout ?? "");
  } catch (error) {
    throw new Error("Failed to parse external policy response as JSON: " + String(error));
  }

  const action = parsed?.action;
  return Number.isInteger(action) ? action : -1;
}

async function selectExploitAction(policyConfig: any, state: any, actionMask: number[]): Promise<number> {
  const valid = actionMask
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === 1)
    .map(entry => entry.index);

  if (valid.length === 0) {
    return -1;
  }

  if (policyConfig?.type === "random") {
    return sampleUniformAction(valid);
  }

  if (policyConfig?.type === "external_command") {
    const action = await runExternalPolicy(policyConfig, state, actionMask);
    if (valid.includes(action)) {
      return action;
    }
    return valid[0];
  }

  return valid[0];
}

function normalizeActionSource(source: string | null | undefined): string {
  switch (source) {
    case "random":
    case "scheduled_random":
    case "first_valid":
    case "external_command":
    case "model":
      return source;
    default:
      return "unknown";
  }
}

async function selectActionFromMask(
  state: any,
  actionMask: number[],
  globalEpisodeIndex: number,
): Promise<{ action: number; actionSource: string }> {
  const valid = actionMask
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === 1)
    .map(entry => entry.index);

  if (valid.length === 0) {
    return { action: -1, actionSource: "unknown" };
  }

  if (POLICY.type === "random") {
    return { action: sampleUniformAction(valid), actionSource: "random" };
  }

  if (POLICY.type === "epsilon_random") {
    const epsilon = computeScheduledEpsilonForPolicy(POLICY, globalEpisodeIndex);
    if (Math.random() < epsilon) {
      return { action: sampleUniformAction(valid), actionSource: "scheduled_random" };
    }
    const exploitPolicy = typeof POLICY.exploit_policy === "object" && POLICY.exploit_policy !== null
      ? POLICY.exploit_policy
      : { type: "first_valid" };
    const exploitAction = await selectExploitAction(exploitPolicy, state, actionMask);
    const actionSource = exploitPolicy.type === "external_command"
      ? (
        Array.isArray(exploitPolicy.command)
          && exploitPolicy.command.some((part: string) => String(part).includes("dqn_policy_infer"))
      )
        ? "model"
        : "external_command"
      : normalizeActionSource(exploitPolicy.type);
    return { action: exploitAction, actionSource };
  }

  if (POLICY.type === "first_valid") {
    return { action: valid[0], actionSource: "first_valid" };
  }

  if (POLICY.type === "external_command") {
    const action = await runExternalPolicy(POLICY, state, actionMask);
    if (valid.includes(action)) {
      const actionSource = Array.isArray(POLICY.command)
        && POLICY.command.some((part: string) => String(part).includes("dqn_policy_infer"))
        ? "model"
        : "external_command";
      return { action, actionSource };
    }
    return { action: valid[0], actionSource: "first_valid" };
  }

  return { action: valid[0], actionSource: "first_valid" };
}

function executeAction(game: GameManager, action: number) {
  if (action < MOVE_ACTIONS) {
    selectMoveByIndex(game, action);
    return;
  }
  const switchIndex = action - MOVE_ACTIONS;
  selectSwitchByPartyIndex(game, switchIndex);
}

function hasRemainingPlayerTeam(game: GameManager): boolean {
  return game.scene.getPlayerParty().some(member => !member.isFainted() && member.isAllowedInBattle());
}

function isVictorySafe(game: GameManager): boolean {
  const battle = game.scene.currentBattle;
  if (!battle || !Array.isArray(battle.enemyParty)) {
    return false;
  }
  return battle.enemyParty.every(pokemon => pokemon.isFainted());
}

function currentWaveIndexSafe(game: GameManager, fallback: number = -1): number {
  const battle = game.scene.currentBattle;
  if (battle && Number.isFinite(battle.waveIndex)) {
    return battle.waveIndex;
  }
  return fallback;
}

function resolveForcedSwitchIfNeeded(game: GameManager): "not_switch_phase" | "selected" | "no_candidate" {
  const battle = game.scene.currentBattle as any;
  if (!game.isCurrentPhase("SwitchPhase")) {
    if (battle && Object.prototype.hasOwnProperty.call(battle, "__collectorForcedSwitchQueued")) {
      delete battle.__collectorForcedSwitchQueued;
    }
    return "not_switch_phase";
  }
  clearStalePromptsForForcedSwitch(game);
  const party = game.scene.getPlayerParty();
  const nextIndex = party.findIndex(member => !member.isFainted() && !member.isOnField() && member.isAllowedInBattle());
  if (nextIndex >= 0) {
    if (game.scene.ui?.getMode?.() === UiMode.PARTY) {
      const handler = game.scene.ui.getHandler() as any;
      if (typeof handler?.setCursor === "function") {
        handler.setCursor(nextIndex);
      }
      if (typeof handler?.processInput === "function" && Number.isInteger(handler?.cursor) && handler.cursor !== nextIndex) {
        const direction = handler.cursor < nextIndex ? Button.DOWN : Button.UP;
        for (let attempts = 0; attempts < 8 && handler.cursor !== nextIndex; attempts += 1) {
          handler.processInput(direction);
        }
      }
      if (typeof handler?.processInput === "function") {
        handler.processInput(Button.ACTION);
        if (handler.optionsMode === true) {
          handler.processInput(Button.ACTION);
        }
      }
    } else if (battle?.__collectorForcedSwitchQueued !== nextIndex) {
      game.doSelectPartyPokemon(nextIndex);
      if (battle) {
        battle.__collectorForcedSwitchQueued = nextIndex;
      }
    }
    return "selected";
  }
  return "no_candidate";
}

function resolveOptionalCheckSwitchIfNeeded(game: GameManager): "not_check_switch" | "skipped" {
  if (!game.isCurrentPhase("CheckSwitchPhase")) {
    return "not_check_switch";
  }
  if (game.scene.ui?.getMode?.() !== UiMode.CONFIRM) {
    return "not_check_switch";
  }
  game.setMode(UiMode.MESSAGE);
  game.endPhase();
  clearStalePromptsForForcedSwitch(game);
  return "skipped";
}

function isHardTerminalPhase(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("TitlePhase");
}

function currentPhaseNameSafe(game: GameManager): string {
  return game.scene.phaseManager.getCurrentPhase()?.constructor?.name ?? "UnknownPhase";
}

function currentUiModeNameSafe(game: GameManager): string {
  const uiMode = game.scene.ui?.getMode?.();
  if (typeof uiMode === "number" && UiMode[uiMode]) {
    return String(UiMode[uiMode]);
  }
  return "UnknownUiMode";
}

function describePartyForDiagnostics(game: GameManager): string {
  return game.scene
    .getPlayerParty()
    .map((member, index) => {
      if (!member) {
        return \`\${index}:empty\`;
      }
      return [
        \`\${index}:\${member.name ?? member.species?.name ?? "unknown"}\`,
        \`hp=\${member.hp}/\${typeof member.getMaxHp === "function" ? member.getMaxHp() : "?"}\`,
        \`fainted=\${member.isFainted?.() === true}\`,
        \`onField=\${member.isOnField?.() === true}\`,
        \`allowed=\${member.isAllowedInBattle?.() === true}\`,
      ].join(",");
    })
    .join(" | ");
}

function describePartyUiHandlerForDiagnostics(game: GameManager): string {
  const handler = game.scene.ui?.getHandler?.() as any;
  if (!handler) {
    return "handler=missing";
  }

  const partyUiMode = typeof handler.partyUiMode === "number" && PartyUiMode[handler.partyUiMode]
    ? String(PartyUiMode[handler.partyUiMode])
    : String(handler.partyUiMode ?? "unknown");

  return [
    "active=" + String(handler.active === true),
    "partyUiMode=" + partyUiMode,
    "cursor=" + String(handler.cursor ?? "unknown"),
    "optionsMode=" + String(handler.optionsMode === true),
    "options=" + String(Array.isArray(handler.options) ? handler.options.length : 0),
    "optionsCursor=" + String(handler.optionsCursor ?? "unknown"),
    "pendingPrompt=" + String(handler.pendingPrompt === true),
    "blockInput=" + String(handler.blockInput === true),
    "awaitingActionInput=" + String(handler.awaitingActionInput === true),
  ].join(",");
}

function describePromptQueueForDiagnostics(game: GameManager): string {
  const prompts = Array.isArray((game.phaseInterceptor as any)?.prompts)
    ? (game.phaseInterceptor as any).prompts
    : [];
  return prompts
    .slice(0, 3)
    .map((prompt: any, index: number) => [
      index,
      String(prompt?.phaseTarget ?? "unknown"),
      String(prompt?.mode ?? "unknown"),
      String(prompt?.awaitingActionInput === true),
    ].join(":"))
    .join("|");
}

function clearStalePromptsForForcedSwitch(game: GameManager): void {
  const interceptor = game.phaseInterceptor as any;
  if (!Array.isArray(interceptor?.prompts) || interceptor.prompts.length === 0) {
    return;
  }

  while (interceptor.prompts.length > 0 && interceptor.prompts[0]?.phaseTarget === "CheckSwitchPhase") {
    interceptor.prompts.shift();
  }
}

const TERMINAL_PHASE_NAMES = [
  "GameOverPhase",
  "PostGameOverPhase",
  "TitlePhase",
  "BattleEndPhase",
  "SelectModifierPhase",
  "EggLapsePhase",
];

function hasLoggedTerminalPhaseSince(game: GameManager, fromIndex: number): boolean {
  const phaseLog = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log : [];
  for (let idx = Math.max(0, fromIndex); idx < phaseLog.length; idx += 1) {
    if (TERMINAL_PHASE_NAMES.includes(String(phaseLog[idx]))) {
      return true;
    }
  }
  return false;
}

function isCollectorEpisodeTerminalPhase(game: GameManager): boolean {
  return isHardTerminalPhase(game)
    || game.isCurrentPhase("BattleEndPhase")
    || game.isCurrentPhase("SelectModifierPhase")
    || (TERMINAL_ON_EGG_LAPSE && game.isCurrentPhase("EggLapsePhase"));
}

function requiresTerminalDrain(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("PostGameOverPhase");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Timeout while waiting for " + label)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

async function waitForPromiseOrTerminal(game: GameManager, promise: Promise<unknown>, timeoutMs: number): Promise<"ok" | "terminal" | "timeout"> {
  let resolved = false;
  let failed = false;

  promise
    .then(() => {
      resolved = true;
    })
    .catch(() => {
      failed = true;
    });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (isCollectorEpisodeTerminalPhase(game)) {
      return "terminal";
    }
    if (resolved) {
      return "ok";
    }
    if (failed) {
      return isCollectorEpisodeTerminalPhase(game) ? "terminal" : "timeout";
    }
    await sleep(25);
  }

  if (isCollectorEpisodeTerminalPhase(game)) {
    return "terminal";
  }

  return "timeout";
}

async function drainTerminalPhase(game: GameManager, timeoutMs: number): Promise<"settled" | "timeout"> {
  if (!requiresTerminalDrain(game)) {
    return "settled";
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (game.isCurrentPhase("TitlePhase")) {
      return "settled";
    }
    await sleep(25);
  }

  return game.isCurrentPhase("TitlePhase") ? "settled" : "timeout";
}

async function waitForCommandOrTerminalAfterForcedSwitch(game: GameManager, timeoutMs: number): Promise<"ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (isCollectorEpisodeTerminalPhase(game)) {
      return "terminal";
    }
    if (game.isCurrentPhase("CommandPhase")) {
      return "ok";
    }
    await sleep(25);
  }

  if (isCollectorEpisodeTerminalPhase(game)) {
    return "terminal";
  }

  return "timeout";
}

async function advanceAfterAction(game: GameManager): Promise<"ok" | "terminal" | "timeout"> {
  const terminalPhasesForTurnAdvance = [
    "GameOverPhase",
    "PostGameOverPhase",
    "TitlePhase",
    "BattleEndPhase",
    "SelectModifierPhase",
    "EggLapsePhase",
  ];
  const endOfTurnStatus = await waitForPromiseOrTerminal(
    game,
    withTimeout(game.toEndOfTurn(), STEP_TIMEOUT_MS, "end of turn"),
    STEP_TIMEOUT_MS,
  );
  if (endOfTurnStatus === "timeout" && game.isCurrentPhase("SwitchPhase")) {
    return waitForCommandOrTerminalAfterForcedSwitch(game, STEP_TIMEOUT_MS);
  }
  if (endOfTurnStatus !== "ok") {
    return endOfTurnStatus;
  }

  if (isCollectorEpisodeTerminalPhase(game)) {
    return "terminal";
  }

  const switchResolveStatus = resolveForcedSwitchIfNeeded(game);
  if (switchResolveStatus === "no_candidate") {
    return "terminal";
  }
  if (!hasRemainingPlayerTeam(game) || isVictorySafe(game)) {
    return "terminal";
  }
  if (game.isCurrentPhase("CommandPhase")) {
    return "ok";
  }

  const phaseLogStart = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log.length : 0;
  let nextTurnResolved = false;
  let nextTurnTerminal = false;
  let nextTurnFailed = false;
  const nextTurnPromise = game
    .toNextTurn(terminalPhasesForTurnAdvance)
    .then(result => {
      if (result === "terminal") {
        nextTurnTerminal = true;
      } else {
        nextTurnResolved = true;
      }
    })
    .catch(() => {
      nextTurnFailed = true;
    });

  const startedAt = Date.now();
  while (Date.now() - startedAt < STEP_TIMEOUT_MS) {
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (nextTurnTerminal || isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
      return "terminal";
    }
    if (nextTurnResolved) {
      return "ok";
    }
    if (nextTurnFailed) {
      return isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart) ? "terminal" : "timeout";
    }
    await sleep(25);
  }

  if (isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
    return "terminal";
  }
  // Prevent unhandled rejection if toNextTurn fails after timeout return path.
  void nextTurnPromise;
  return "timeout";
}

function applyScenarioOverrides(game: GameManager, scenario: any, seedOverride: string | null) {
  const effectiveSeed = seedOverride ?? scenario.seed ?? null;
  const waveIndex = getScenarioWaveIndex(scenario);
  const battleStyle = mapBattleStyleName(scenario.battle_style);
  const battleType = mapBattleTypeName(getScenarioBattleTypeName(scenario));
  const trainerType = battleType === BattleType.TRAINER ? mapTrainerTypeName(scenario.trainer?.trainer_type) : null;

  if (effectiveSeed) {
    game.override.seed(effectiveSeed);
  }
  if (Number.isFinite(waveIndex)) {
    game.override.startingWave(waveIndex);
  }
  if (battleStyle != null) {
    game.override.battleStyle(battleStyle);
  }
  game.override.battleType(battleType);
  if (trainerType != null) {
    game.override.randomTrainer({ trainerType });
  }
}

async function startScenarioBattle(game: GameManager, scenario: any, teamSpecies: number[]) {
  await game.runToTitle();

  game.onNextPrompt("TitlePhase", UiMode.TITLE, () => {
    game.scene.gameMode = getGameMode(GameModes.CLASSIC);
    const starters = generateStarters(game.scene, teamSpecies as any);
    const selectStarterPhase = new SelectStarterPhase();
    game.scene.phaseManager.pushPhase(new EncounterPhase(false));
    selectStarterPhase.initBattle(starters);
  });

  await game.phaseInterceptor.to("EncounterPhase", false);

  if (overrides.ENEMY_HELD_ITEMS_OVERRIDE.length === 0) {
    game.removeEnemyHeldItems();
  }

  prepareScenarioBattleBeforeEncounter(game, scenario);

  await game.phaseInterceptor.to("CommandPhase");
}

describe("external combat collector", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  afterAll(() => {
    cleanupPersistentExternalPolicyWorkers();
  });

  it("collects multi-step transitions across scenarios", async () => {
    const runStartedAt = Date.now();
    let totalTransitions = 0;
    let totalEpisodes = 0;
    let globalEpisodeIndex = EPISODE_INDEX_OFFSET;
    let nextProgressPausePercent = PROGRESS_PAUSE_PERCENT_STEP;

    try {
      for (const scenario of SCENARIOS) {
        for (const seedOverride of SEEDS) {
          for (let episodeIndex = 0; episodeIndex < EPISODES_PER_SEED; episodeIndex += 1) {
            const game = new GameManager(phaserGame);
            try {
            applyScenarioOverrides(game, scenario, seedOverride);

            const teamSpecies = scenario.player_team.map(member => member.species_id);
            await startScenarioBattle(game, scenario, teamSpecies);
            applyScenarioMaterializedState(game, scenario);

            const episodeId = \`\${scenario.__scenario_name}::\${seedOverride ?? scenario.seed ?? "seedless"}::\${globalEpisodeIndex}\`;
            const effectiveSeed = seedOverride ?? scenario.seed ?? "seedless";
            const episodeStateVariant = selectEpisodeStateVariant(globalEpisodeIndex);
            applyStateVariant(game, scenario, episodeStateVariant, episodeId);
            let previousAction: number | null = null;
            let lastSwitchOriginPartyIndex: number | null = null;
            let consecutiveSwitchCount = 0;

              for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_EPISODE; stepIndex += 1) {
              const state = buildObservation(game, scenario);
              const { action, actionSource } = await selectActionFromMask(state, state.action_mask, globalEpisodeIndex);
              if (action < 0) {
                break;
              }
              const playerTeamHpBeforeAction = getPlayerTeamHpRatio(game);
              const enemyTeamHpBeforeAction = getEnemyTeamHpRatio(game);

              const stepStartAt = Date.now();
              executeAction(game, action);
              const advanceStatus = await advanceAfterAction(game);
              const stepMs = Date.now() - stepStartAt;

              const enemyPokemon = game.scene.getEnemyPokemon();
              const playerPokemon = game.scene.getPlayerPokemon();
              const enemyFainted = !enemyPokemon || enemyPokemon.hp <= 0 || enemyPokemon.isFainted();
              const playerFainted = !playerPokemon || playerPokemon.hp <= 0 || playerPokemon.isFainted();
              const enemyTeamDefeated = isVictorySafe(game);
              const playerTeamDefeated = !hasRemainingPlayerTeam(game);
              const hardTerminalPhase = isCollectorEpisodeTerminalPhase(game);
              const timeoutTruncated = advanceStatus === "timeout";
              let done = enemyTeamDefeated || playerTeamDefeated || hardTerminalPhase || timeoutTruncated;
              const nextState = done
                ? deriveTerminalNextState(state, enemyTeamDefeated, playerTeamDefeated)
                : buildObservation(game, scenario);
              const nextPlayerTeamHp = playerTeamDefeated ? 0 : getPlayerTeamHpRatio(game);
              const nextEnemyTeamHp = enemyTeamDefeated ? 0 : getEnemyTeamHpRatio(game);
              const alivePlayerTeamMembers = countAlivePlayerTeamMembers(game);
              const activePartyIndexBeforeAction = findActivePartySlotIndex(state);
              let reward = REWARD_STEP_PENALTY;
              const enemyTeamHpDamage = Math.max(0, enemyTeamHpBeforeAction - nextEnemyTeamHp);
              const playerTeamHpLoss = Math.max(0, playerTeamHpBeforeAction - nextPlayerTeamHp);
              reward += enemyTeamHpDamage * REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE;
              reward += playerTeamHpLoss * REWARD_PLAYER_TEAM_HP_LOSS_SCALE;
              if (action >= MOVE_ACTIONS) {
                const switchTargetIndex = action - MOVE_ACTIONS;
                reward += REWARD_SWITCH_PENALTY;
                if (previousAction != null && previousAction >= MOVE_ACTIONS) {
                  reward += REWARD_CONSECUTIVE_SWITCH_PENALTY;
                  reward += consecutiveSwitchCount * REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE;
                }
                if (lastSwitchOriginPartyIndex != null && switchTargetIndex === lastSwitchOriginPartyIndex) {
                  reward += REWARD_DIRECT_BACKSWITCH_PENALTY;
                }
              }
              if (enemyFainted) reward += REWARD_ENEMY_FAINT_BONUS;
              if (playerFainted) reward += REWARD_PLAYER_FAINT_PENALTY;
              if (enemyTeamDefeated) {
                reward += REWARD_ENEMY_TEAM_DEFEAT_BONUS;
                reward += alivePlayerTeamMembers * REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS;
                reward += nextPlayerTeamHp * REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE;
              }
              if (playerTeamDefeated) reward += REWARD_PLAYER_TEAM_DEFEAT_PENALTY;

              if (!done && stepIndex === MAX_STEPS_PER_EPISODE - 1) {
                done = true;
              }

              const record = {
                episode_id: episodeId,
                step_index: stepIndex,
                state,
                action,
                reward,
                next_state: nextState,
                done,
                meta: {
                  seed: effectiveSeed,
                  wave: currentWaveIndexSafe(game, state.wave_index),
                  battle_type: "single",
                  scenario: scenario.__scenario_name,
                  state_variant: episodeStateVariant,
                  action_source: actionSource,
                  outcome: enemyTeamDefeated ? "win" : playerTeamDefeated ? "loss" : timeoutTruncated ? "timeout" : "truncated",
                },
                timestamp: Date.now(),
              };

              fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
              fs.appendFileSync(OUTPUT_PATH, \`\${JSON.stringify(record)}\\n\`, { encoding: "utf8" });
              totalTransitions += 1;
              if (action >= MOVE_ACTIONS) {
                lastSwitchOriginPartyIndex = activePartyIndexBeforeAction >= 0 ? activePartyIndexBeforeAction : null;
                consecutiveSwitchCount += 1;
              } else {
                lastSwitchOriginPartyIndex = null;
                consecutiveSwitchCount = 0;
              }
              previousAction = action;
              if (
                PROGRESS_PAUSE_ENABLED
                && PROGRESS_PAUSE_TARGET_TRANSITIONS > 0
                && nextProgressPausePercent <= 100
              ) {
                const currentPercent = Math.floor((totalTransitions / PROGRESS_PAUSE_TARGET_TRANSITIONS) * 100);
                if (currentPercent >= nextProgressPausePercent) {
                  const elapsedMs = Date.now() - runStartedAt;
                  const estimatedTotalMs = totalTransitions > 0
                    ? (elapsedMs / totalTransitions) * PROGRESS_PAUSE_TARGET_TRANSITIONS
                    : 0;
                  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
                  console.log(
                    \`[collector-progress-pause] transitions=\${totalTransitions}/\${PROGRESS_PAUSE_TARGET_TRANSITIONS} reached=\${nextProgressPausePercent}% elapsed=\${formatDuration(elapsedMs)} eta_remaining=\${formatDuration(remainingMs)} pausing_ms=\${PROGRESS_PAUSE_MS}\`,
                  );
                  if (PROGRESS_PAUSE_MS > 0) {
                    await sleep(PROGRESS_PAUSE_MS);
                  }
                  nextProgressPausePercent += PROGRESS_PAUSE_PERCENT_STEP;
                }
              }

              if (done) {
                const drainStatus = await drainTerminalPhase(game, STEP_TIMEOUT_MS);
                if (drainStatus === "timeout") {
                  console.log(\`[collector-terminal-drain-timeout] episode=\${episodeId} step=\${stepIndex} phase=\${currentPhaseNameSafe(game)}\`);
                }
                if (timeoutTruncated) {
                  console.log(
                    \`[collector-timeout] episode=\${episodeId} step=\${stepIndex} phase=\${currentPhaseNameSafe(game)} ui_mode=\${currentUiModeNameSafe(game)} advance_status=\${advanceStatus} step_ms=\${stepMs} player_party="\${describePartyForDiagnostics(game)}" party_ui="\${describePartyUiHandlerForDiagnostics(game)}" prompts="\${describePromptQueueForDiagnostics(game)}"\`,
                  );
                }
                break;
              }
            }

              totalEpisodes += 1;
              globalEpisodeIndex += 1;
              console.log(\`[collector-progress] episodes=\${totalEpisodes}/\${PLANNED_EPISODES} transitions=\${totalTransitions}\`);
            } finally {
              game.phaseInterceptor.restoreOg();
            }
          }
        }
      }

      console.log(\`Collected episodes: \${totalEpisodes}\`);
      console.log(\`Collected transitions: \${totalTransitions}\`);
      const totalRuntimeMs = Date.now() - runStartedAt;
      console.log(\`Collector runtime ms: \${totalRuntimeMs}\`);
      if (PROGRESS_PAUSE_TARGET_TRANSITIONS > 0) {
        if (totalTransitions >= PROGRESS_PAUSE_TARGET_TRANSITIONS) {
          console.log(\`Collector target reached: \${PROGRESS_PAUSE_TARGET_TRANSITIONS} transitions\`);
        } else {
          console.log(\`Collector target not reached: \${totalTransitions}/\${PROGRESS_PAUSE_TARGET_TRANSITIONS} transitions\`);
        }
      }
    } finally {
      cleanupPersistentExternalPolicyWorkers();
    }
  }, TEST_TIMEOUT_MS);
});
`;

mkdirSync(tempDir, { recursive: true });
writeFileSync(tempTestPath, testSource, { encoding: "utf8" });

const runnerEnv = {
  ...process.env,
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}`,
};

const result = spawnSync(
  pokerogueVitestBin,
  ["run", tempTestRelativePath, "--no-isolate"],
  {
    cwd: pokerogueRoot,
    env: runnerEnv,
    stdio: "inherit",
  },
);

try {
  rmSync(tempTestPath, { force: true });
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Cleanup is best-effort.
}

if (result.status !== 0 && !existsSync(outputPath)) {
  process.exit(result.status ?? 1);
}

if (existsSync(outputPath)) {
  const lineCount = readFileSync(outputPath, "utf8")
    .split("\n")
    .filter(Boolean).length;
  console.log("Collector output:", outputPath);
  console.log("Transition lines:", lineCount);
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}

function resolveScenarioPaths(runConfig, runConfigDir) {
  if (Array.isArray(runConfig.scenario_files) && runConfig.scenario_files.length > 0) {
    return runConfig.scenario_files.map(p => path.resolve(runConfigDir, p));
  }

  const scenarioDir = runConfig.scenario_dir
    ? path.resolve(runConfigDir, runConfig.scenario_dir)
    : path.join(repoRoot, "data", "rl", "scenarios");

  if (!existsSync(scenarioDir)) {
    return [];
  }

  return readdirSync(scenarioDir)
    .filter(name => name.endsWith(".json"))
    .map(name => path.join(scenarioDir, name));
}
