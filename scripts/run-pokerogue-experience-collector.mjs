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
const tempDir = path.join(pokerogueRoot, "test", ".external-rl");
const tempTestPath = path.join(tempDir, "experience-collector.test.ts");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "collector-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

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
const stateVariants = Array.isArray(config.state_variants) && config.state_variants.length > 0
  ? config.state_variants.map(String)
  : [];
const quietGameLogs = config.quiet_game_logs === true || process.env.COLLECTOR_QUIET_GAME_LOGS === "1";

mkdirSync(path.dirname(outputPath), { recursive: true });
if (!appendOutput && existsSync(outputPath)) {
  unlinkSync(outputPath);
}

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { spawnSync as spawnSyncChild } from "node:child_process";
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
import { Nature } from "#enums/nature";
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
import { beforeAll, describe, it } from "vitest";

const SCENARIOS = ${JSON.stringify(scenarios)};
const SEEDS = ${JSON.stringify(seeds)};
const EPISODES_PER_SEED = ${episodesPerSeed};
const MAX_STEPS_PER_EPISODE = ${maxStepsPerEpisode};
const POLICY = ${JSON.stringify(policy)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};
const TEST_TIMEOUT_MS = ${testTimeoutMs};
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
const STEP_TIMEOUT_MS = Number.isFinite(POLICY.step_timeout_ms) && POLICY.step_timeout_ms > 0
  ? POLICY.step_timeout_ms
  : 15000;
const MOVE_ACTIONS = 4;
const SWITCH_ACTIONS = 6;
const ACTION_DIM = MOVE_ACTIONS + SWITCH_ACTIONS;
const CRITICAL_HP_RATIO = 0.1;
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

function isScenarioV2(scenario: any): boolean {
  return Number.isInteger(scenario?.wave_index)
    && Array.isArray(scenario?.enemy_team)
    && scenario?.source != null;
}

function getScenarioWaveIndex(scenario: any): number | null {
  if (Number.isInteger(scenario?.wave_index)) {
    return Number(scenario.wave_index);
  }
  if (Number.isInteger(scenario?.wave)) {
    return Number(scenario.wave);
  }
  return null;
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

  const sourcePath = typeof scenario?.__scenario_source_path === "string"
    ? scenario.__scenario_source_path.toLowerCase()
    : "";
  const scenarioName = typeof scenario?.__scenario_name === "string"
    ? scenario.__scenario_name.toLowerCase()
    : "";

  return sourcePath.includes(path.sep + "trainer" + path.sep) || scenarioName.includes("trainer-");
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

function applyScenarioHpRatios(game: GameManager, scenario: any) {
  const party = game.scene.getPlayerParty();
  const scenarioTeam = Array.isArray(scenario.player_team) ? scenario.player_team : [];
  for (let idx = 0; idx < scenarioTeam.length; idx += 1) {
    const ratio = scenarioTeam[idx]?.hp_ratio;
    if (Number.isFinite(ratio)) {
      setPokemonHpRatio(party[idx], Number(ratio));
    }
  }

  const enemyRatio = scenario?.enemy?.hp_ratio;
  if (Number.isFinite(enemyRatio)) {
    setPokemonHpRatio(game.scene.getEnemyPokemon(), Number(enemyRatio));
  }
}

function applyScenarioMaterializedState(game: GameManager, scenario: any) {
  if (!isScenarioV2(scenario)) {
    return;
  }

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
  if (!isScenarioV2(scenario)) {
    return;
  }

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

  const scenarioTrainerType = mapTrainerTypeName(scenario.trainer_type);
  if (scenarioTrainerType != null && battle.trainer.config?.trainerType !== scenarioTrainerType) {
    throw new Error(
      "Trainer type mismatch before EncounterPhase: expected "
      + String(scenario.trainer_type)
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
  const moves = player.getMoveset().slice(0, 4).map(move => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    const ppRatio = ppMax > 0 ? ppLeft / ppMax : 0;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const moveType = moveData.type;
    const stab = playerTypes.includes(moveType) ? 1 : 0;
    return {
      available: ppLeft > 0 ? 1 : 0,
      power_bucket: powerBucket(Number.isFinite(moveData.power) ? moveData.power : 0),
      effectiveness_bucket: effectivenessBucket(Number.isFinite(effectiveness) ? effectiveness : 1),
      stab,
      pp_low: ppLeft > 0 && ppRatio <= 0.2 ? 1 : 0,
    };
  });

  const actionMask = Array.from({ length: ACTION_DIM }, () => 0);
  for (let idx = 0; idx < moves.length; idx += 1) {
    actionMask[idx] = moves[idx].available;
  }

  const party = game.scene.getPlayerParty();
  const switchableMembers: Array<{ hpRatio: number; bestEffectiveness: number }> = [];
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
      };
    }

    const hpRatio = getHpRatio(member.hp, member.getMaxHp());
    const types = member
      .getTypes(true, true)
      .filter(type => Number.isInteger(type) && type >= 0)
      .slice(0, 2);

    const canSwitch = !member.isOnField() && !member.isFainted() && member.isAllowedInBattle();
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
      switchableMembers.push({ hpRatio, bestEffectiveness });
    }

    return {
      present: 1,
      active: member.isOnField() ? 1 : 0,
      fainted: member.isFainted() ? 1 : 0,
      hp_ratio: hpRatio,
      level: member.level,
      types,
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

  return {
    wave_index: game.scene.currentBattle.waveIndex,
    player_hp_ratio: playerHpRatio,
    enemy_hp_ratio: enemyHpRatio,
    player_hp_bucket: hpBucket(playerHpRatio),
    enemy_hp_bucket: hpBucket(enemyHpRatio),
    hp_diff_bucket: hpDiffBucket(playerHpRatio - enemyHpRatio),
    level_gap_bucket: levelGapBucket(player.level - enemy.level),
    is_trainer_battle: isTrainerBattle ? 1 : 0,
    alive_bench_count_bucket: countBucket(aliveBenchCount),
    healthy_bench_count_bucket: countBucket(healthyBenchCount),
    best_switch_matchup_bucket: effectivenessBucket(bestSwitchEffectiveness),
    worst_switch_risk_bucket: worstSwitchRiskBucket,
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

function computeScheduledEpsilon(globalEpisodeIndex: number): number {
  if (POLICY.type !== "epsilon_random") {
    return Number.isFinite(POLICY.epsilon) ? POLICY.epsilon : 1.0;
  }

  const start = Number.isFinite(POLICY.start_epsilon) ? POLICY.start_epsilon : 1.0;
  const end = Number.isFinite(POLICY.end_epsilon) ? POLICY.end_epsilon : 0.05;
  const decayEpisodes = Number.isFinite(POLICY.decay_episodes) && POLICY.decay_episodes > 0
    ? POLICY.decay_episodes
    : 100;

  const progress = Math.max(0, Math.min(1, globalEpisodeIndex / decayEpisodes));
  return start + (end - start) * progress;
}

function sampleWeightedAction(valid: number[]): number {
  const switchWeight = Number.isFinite(POLICY.switch_action_weight) && POLICY.switch_action_weight >= 0
    ? POLICY.switch_action_weight
    : 0.25;

  const weights = valid.map(action => (action < MOVE_ACTIONS ? 1.0 : switchWeight));
  const weightSum = weights.reduce((acc, value) => acc + value, 0);
  if (weightSum <= 0) {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  let roll = Math.random() * weightSum;
  for (let i = 0; i < valid.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return valid[i];
    }
  }
  return valid[valid.length - 1];
}

function runExternalPolicy(state: any, actionMask: number[]): number {
  if (!Array.isArray(POLICY.command) || POLICY.command.length === 0) {
    throw new Error("POLICY.command must be a non-empty string array for external_command");
  }

  const [command, ...args] = POLICY.command;
  const timeoutMs = Number.isFinite(POLICY.timeout_ms) && POLICY.timeout_ms > 0
    ? POLICY.timeout_ms
    : 5000;
  const env = typeof POLICY.env === "object" && POLICY.env !== null
    ? { ...process.env, ...POLICY.env }
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

function selectActionFromMask(state: any, actionMask: number[], globalEpisodeIndex: number): number {
  const valid = actionMask
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === 1)
    .map(entry => entry.index);

  if (valid.length === 0) {
    return -1;
  }

  if (POLICY.type === "random") {
    return sampleWeightedAction(valid);
  }

  if (POLICY.type === "epsilon_random") {
    const epsilon = computeScheduledEpsilon(globalEpisodeIndex);
    if (Math.random() < epsilon) {
      return sampleWeightedAction(valid);
    }
    return valid[0];
  }

  if (POLICY.type === "first_valid") {
    return valid[0];
  }

  if (POLICY.type === "external_command") {
    const action = runExternalPolicy(state, actionMask);
    if (valid.includes(action)) {
      return action;
    }
    return valid[0];
  }

  return valid[0];
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
  if (isScenarioV2(scenario)) {
    const effectiveSeed = seedOverride ?? scenario.seed ?? null;
    const waveIndex = getScenarioWaveIndex(scenario);
    const battleStyle = mapBattleStyleName(scenario.battle_style);
    const battleType = mapBattleTypeName(getScenarioBattleTypeName(scenario));
    const trainerType = battleType === BattleType.TRAINER ? mapTrainerTypeName(scenario.trainer_type) : null;

    if (effectiveSeed) {
      game.override.seed(effectiveSeed);
    }
    if (waveIndex != null) {
      game.override.startingWave(waveIndex);
    }
    if (battleStyle != null) {
      game.override.battleStyle(battleStyle);
    }
    game.override.battleType(battleType);
    if (trainerType != null) {
      game.override.randomTrainer({ trainerType });
    }
    return;
  }

  const lead = scenario.player_team?.[0] ?? {};
  const enemy = scenario.enemy ?? {};
  const effectiveSeed = seedOverride ?? scenario.seed;

  game.override.disableTrainerWaves();

  if (effectiveSeed) {
    game.override.seed(effectiveSeed);
  }

  if (Number.isFinite(scenario.wave)) {
    game.override.startingWave(scenario.wave);
  }

  if (lead.level) {
    game.override.startingLevel(lead.level);
  }
  if (Number.isInteger(lead.nature)) {
    game.override.nature(lead.nature);
  }
  if (Number.isInteger(lead.ability_index)) {
    game.override.ability(lead.ability_index);
  }
  if (Array.isArray(lead.ivs) && lead.ivs.length === 6) {
    game.override.playerIVs(lead.ivs);
  }
  if (Array.isArray(lead.moveset) && lead.moveset.length > 0) {
    game.override.moveset(lead.moveset);
  }
  if (Array.isArray(lead.held_items) && lead.held_items.length > 0) {
    game.override.startingHeldItems(lead.held_items);
  }

  if (enemy.species_id) {
    game.override.enemySpecies(enemy.species_id);
  }
  if (enemy.level) {
    game.override.enemyLevel(enemy.level);
  }
  if (Number.isInteger(enemy.nature)) {
    game.override.enemyNature(enemy.nature);
  }
  if (Number.isInteger(enemy.ability_index)) {
    game.override.enemyAbility(enemy.ability_index);
  }
  if (Array.isArray(enemy.ivs) && enemy.ivs.length === 6) {
    game.override.enemyIVs(enemy.ivs);
  }
  if (Array.isArray(enemy.moveset) && enemy.moveset.length > 0) {
    game.override.enemyMoveset(enemy.moveset);
  }
  if (Array.isArray(enemy.held_items) && enemy.held_items.length > 0) {
    game.override.enemyHeldItems(enemy.held_items);
  }
}

async function startScenarioBattle(game: GameManager, scenario: any, teamSpecies: number[]) {
  if (!isScenarioV2(scenario)) {
    await game.classicMode.startBattle(teamSpecies);
    return;
  }

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

describe("external combat batch collector", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  it("collects multi-step transitions across scenarios", async () => {
    const runStartedAt = Date.now();
    let totalTransitions = 0;
    let totalEpisodes = 0;
    let globalEpisodeIndex = 0;
    const plannedEpisodes = SCENARIOS.length * SEEDS.length * EPISODES_PER_SEED;
    let nextProgressPausePercent = PROGRESS_PAUSE_PERCENT_STEP;

    for (const scenario of SCENARIOS) {
      for (const seedOverride of SEEDS) {
        for (let episodeIndex = 0; episodeIndex < EPISODES_PER_SEED; episodeIndex += 1) {
          const game = new GameManager(phaserGame);
          try {
            applyScenarioOverrides(game, scenario, seedOverride);

            const teamSpecies = scenario.player_team.map(member => member.species_id);
            await startScenarioBattle(game, scenario, teamSpecies);
            applyScenarioMaterializedState(game, scenario);

            const episodeId = \`\${scenario.__scenario_name}::\${seedOverride ?? scenario.seed ?? "seedless"}::\${episodeIndex}\`;
            const effectiveSeed = seedOverride ?? scenario.seed ?? "seedless";
            const episodeStateVariant = selectEpisodeStateVariant(globalEpisodeIndex);
            applyScenarioHpRatios(game, scenario);
            applyStateVariant(game, scenario, episodeStateVariant, episodeId);
            let previousAction: number | null = null;
            let lastSwitchOriginPartyIndex: number | null = null;
            let consecutiveSwitchCount = 0;

            for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_EPISODE; stepIndex += 1) {
              const state = buildObservation(game, scenario);
              const action = selectActionFromMask(state, state.action_mask, globalEpisodeIndex);
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
            console.log(\`[collector-progress] episodes=\${totalEpisodes}/\${plannedEpisodes} transitions=\${totalTransitions}\`);
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
  "npx",
  ["vitest", "run", "test/.external-rl/experience-collector.test.ts", "--no-isolate"],
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
