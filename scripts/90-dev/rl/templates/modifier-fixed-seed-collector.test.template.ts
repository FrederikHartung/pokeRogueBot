import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface, type Interface } from "node:readline";
import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { allMoves } from "#data/data-lists";
import { MoveId } from "#enums/move-id";
import { MoveCategory } from "#enums/move-category";
import { MoveUseMode } from "#enums/move-use-mode";
import { Nature } from "#enums/nature";
import { PokemonType } from "#enums/pokemon-type";
import { ShopCursorTarget } from "#enums/shop-cursor-target";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
import { PartyUiMode } from "#ui/party-ui-handler";
import { GameManager } from "#test/test-utils/game-manager";
import Phaser from "phaser";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type ModifierPolicy = "random_executable";

interface BattlerSnapshot {
  species_id: number;
  species_name: string;
  level: number;
  hp_ratio: number;
}

interface CombatDecisionSnapshot {
  state: Record<string, unknown>;
  wave_index: number;
  turn_index: number;
  is_double_battle: boolean;
  player: BattlerSnapshot;
  enemy: BattlerSnapshot;
  action_mask: number[];
  selected_action: number;
  action_source: string;
}

interface ModifierOptionSnapshot {
  index: number;
  modifier_type_id: string;
  cost: number;
  upgrade_count: number;
  tier: number;
}

interface ModifierActionSnapshot {
  action_index: number;
  action_type: "take_reward" | "buy_shop_item" | "skip";
  reward_index?: number;
  target_party_index?: number;
  shop_row_index?: number;
  shop_column_index?: number;
  modifier_type_id?: string;
  cost: number;
  available: boolean;
  executable: boolean;
  unavailable_reason?: string;
  non_executable_reason?: string;
}

interface ModifierDecisionSnapshot {
  wave_index: number;
  reward_options: ModifierOptionSnapshot[];
  shop_rows: ModifierOptionSnapshot[][];
  actions: ModifierActionSnapshot[];
  action_mask: number[];
}

interface ModifierStepRecord {
  wave_index: number;
  combat_turns: CombatDecisionSnapshot[];
  modifier_decision: ModifierDecisionSnapshot;
  selected_action: ModifierActionSnapshot;
  immediate_reward: number;
}

interface MoveSnapshot {
  move_id: number;
  move_name: string;
  pp_left: number;
  pp_max: number;
}

interface PartyMemberDebugSnapshot {
  species_name: string;
  level: number;
  hp_ratio: number;
  fainted: boolean;
  moves: MoveSnapshot[];
}

interface SelectedModifierActionDebugSnapshot {
  action_index: number;
  action_type: string;
  modifier_type_id?: string;
  reward_index?: number;
  target_party_index?: number;
  shop_row_index?: number;
  shop_column_index?: number;
  cost: number;
}

interface TimeoutDebugSnapshot {
  phase_name: string;
  ui_mode: string;
  wave_index: number | null;
  turn_index: number | null;
  combat_turn_count: number | null;
  money: number | null;
  current_battle_double: boolean | null;
  player_active_species: string | null;
  enemy_active_species: string | null;
  reward_option_ids: string[];
  shop_option_ids: string[][];
  party_ui_mode: string | null;
  party_cursor: number | null;
  party_options_mode: boolean | null;
  party_options_cursor: number | null;
  party_options: string[];
  recent_messages: string[];
  selected_modifier_action?: SelectedModifierActionDebugSnapshot;
  party: PartyMemberDebugSnapshot[];
}

interface EpisodeRecord {
  run_index: number;
  seed: string;
  max_waves: number;
  modifier_policy: ModifierPolicy;
  runtime_ms: number;
  completed_waves: number;
  wave_reached: number;
  termination_reason: string;
  local_reward_sum: number;
  terminal_reward: number;
  total_reward: number;
  steps: ModifierStepRecord[];
  timeout_debug?: TimeoutDebugSnapshot;
}

const OUTPUT_PATH = __OUTPUT_PATH__;
const SEED = __SEED__;
const RUN_COUNT = __RUN_COUNT__;
const MAX_WAVES = __MAX_WAVES__;
const MODIFIER_POLICY = __MODIFIER_POLICY__ as ModifierPolicy;
const COMBAT_DQN_CHECKPOINT = __COMBAT_DQN_CHECKPOINT__;
const COMBAT_DQN_DEVICE = __COMBAT_DQN_DEVICE__;
const COMBAT_DQN_PYTHON = __COMBAT_DQN_PYTHON__;
const COMBAT_DQN_WORKER_SCRIPT = __COMBAT_DQN_WORKER_SCRIPT__;
const STARTER_SPECIES = [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE];
const STEP_TIMEOUT_MS = __STEP_TIMEOUT_MS__;
const MAX_COMBAT_TURNS_PER_WAVE = 200;
const MOVE_ACTIONS = 4;
const ACTION_DIM = 10;
const WAVE_LIB_W1_STARTERS = [
  {
    speciesId: SpeciesId.BULBASAUR,
    level: 5,
    nature: Nature.DOCILE,
    ability: AbilityId.OVERGROW,
    ivs: [15, 15, 15, 15, 15, 15],
    moveset: [MoveId.TACKLE, MoveId.GROWL, MoveId.VINE_WHIP],
  },
  {
    speciesId: SpeciesId.CHARMANDER,
    level: 5,
    nature: Nature.QUIRKY,
    ability: AbilityId.BLAZE,
    ivs: [15, 15, 15, 15, 15, 15],
    moveset: [MoveId.SCRATCH, MoveId.GROWL, MoveId.EMBER],
  },
  {
    speciesId: SpeciesId.SQUIRTLE,
    level: 5,
    nature: Nature.HARDY,
    ability: AbilityId.TORRENT,
    ivs: [15, 15, 15, 15, 15, 15],
    moveset: [MoveId.TACKLE, MoveId.TAIL_WHIP, MoveId.WATER_GUN],
  },
];
const SAFE_REWARD_ACTION_IDS = new Set([
  "POKEBALL",
  "GREAT_BALL",
  "ULTRA_BALL",
  "MASTER_BALL",
  "LURE",
  "SUPER_LURE",
  "MAX_LURE",
  "BERRY",
  "TEMP_STAT_STAGE_BOOSTER",
  "NUGGET",
  "BIG_NUGGET",
]);
const BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS = new Set([
  "DARK_STONE",
  "LIGHT_STONE",
  "N_SOLARIZER",
  "N_LUNARIZER",
  "ULTRANECROZIUM_Z",
  "ICY_REINS_OF_UNITY",
  "SHADOW_REINS_OF_UNITY",
  "FIST_PLATE",
  "SKY_PLATE",
  "TOXIC_PLATE",
  "EARTH_PLATE",
  "STONE_PLATE",
  "INSECT_PLATE",
  "SPOOKY_PLATE",
  "IRON_PLATE",
  "FLAME_PLATE",
  "SPLASH_PLATE",
  "MEADOW_PLATE",
  "ZAP_PLATE",
  "MIND_PLATE",
  "ICICLE_PLATE",
  "DRACO_PLATE",
  "DREAD_PLATE",
  "PIXIE_PLATE",
  "BLANK_PLATE",
  "LEGEND_PLATE",
  "FIGHTING_MEMORY",
  "FLYING_MEMORY",
  "POISON_MEMORY",
  "GROUND_MEMORY",
  "ROCK_MEMORY",
  "BUG_MEMORY",
  "GHOST_MEMORY",
  "STEEL_MEMORY",
  "FIRE_MEMORY",
  "WATER_MEMORY",
  "GRASS_MEMORY",
  "ELECTRIC_MEMORY",
  "PSYCHIC_MEMORY",
  "ICE_MEMORY",
  "DRAGON_MEMORY",
  "DARK_MEMORY",
  "FAIRY_MEMORY",
  "NORMAL_MEMORY",
]);
const SPECIES_STAT_BOOSTER_ELIGIBLE_SPECIES: Record<string, SpeciesId[]> = {
  LIGHT_BALL: [SpeciesId.PIKACHU],
  THICK_CLUB: [SpeciesId.CUBONE, SpeciesId.MAROWAK, SpeciesId.ALOLA_MAROWAK],
  METAL_POWDER: [SpeciesId.DITTO],
  QUICK_POWDER: [SpeciesId.DITTO],
  DEEP_SEA_SCALE: [SpeciesId.CLAMPERL],
  DEEP_SEA_TOOTH: [SpeciesId.CLAMPERL],
};

interface PersistentCombatDqnWorker {
  child: ReturnType<typeof spawn>;
  readline: Interface;
  pending: Array<{ resolve: (action: number) => void; reject: (error: Error) => void }>;
  stderrChunks: string[];
}

let persistentCombatDqnWorker: PersistentCombatDqnWorker | null = null;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDeterministicRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0;
    return state / 4294967296;
  };
}

function toHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, hp / maxHp));
}

function buildStateFromSnapshot(game: GameManager): Record<string, unknown> {
  return buildCombatObservation(game);
}

function describeCombatWorkerStderr(): string {
  if (!persistentCombatDqnWorker || persistentCombatDqnWorker.stderrChunks.length === 0) {
    return "";
  }
  return persistentCombatDqnWorker.stderrChunks.join("");
}

function cleanupPersistentCombatDqnWorker(): void {
  if (!persistentCombatDqnWorker) {
    return;
  }
  const worker = persistentCombatDqnWorker;
  persistentCombatDqnWorker = null;
  while (worker.pending.length > 0) {
    worker.pending.shift()?.reject(new Error("Combat DQN worker cleaned up"));
  }
  try {
    worker.child.stdin.write(JSON.stringify({ shutdown: true }) + "\n");
  } catch {
    // Best-effort.
  }
  try {
    worker.readline.close();
  } catch {
    // Best-effort.
  }
  try {
    worker.child.stdin.end();
  } catch {
    // Best-effort.
  }
  try {
    worker.child.kill("SIGTERM");
  } catch {
    // Best-effort.
  }
}

function getOrStartPersistentCombatDqnWorker(): PersistentCombatDqnWorker {
  if (persistentCombatDqnWorker) {
    return persistentCombatDqnWorker;
  }

  const child = spawn(
    COMBAT_DQN_PYTHON,
    [COMBAT_DQN_WORKER_SCRIPT, "--checkpoint", COMBAT_DQN_CHECKPOINT, "--device", COMBAT_DQN_DEVICE],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    },
  );
  const readline = createInterface({ input: child.stdout });
  const worker: PersistentCombatDqnWorker = {
    child,
    readline,
    pending: [],
    stderrChunks: [],
  };

  readline.on("line", (line: string) => {
    const pending = worker.pending.shift();
    if (!pending) {
      return;
    }
    try {
      const payload = JSON.parse(line);
      const action = payload?.action;
      if (Number.isInteger(action)) {
        pending.resolve(action);
        return;
      }
      pending.reject(new Error(typeof payload?.error === "string" ? payload.error : "Combat DQN worker returned invalid payload"));
    } catch (error) {
      pending.reject(new Error("Failed to parse combat DQN worker response: " + String(error)));
    }
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    worker.stderrChunks.push(String(chunk));
    if (worker.stderrChunks.length > 20) {
      worker.stderrChunks.shift();
    }
  });

  child.on("error", (error: Error) => {
    persistentCombatDqnWorker = null;
    while (worker.pending.length > 0) {
      worker.pending.shift()?.reject(new Error("Combat DQN worker failed: " + String(error) + " " + describeCombatWorkerStderr()));
    }
  });

  child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
    persistentCombatDqnWorker = null;
    while (worker.pending.length > 0) {
      worker.pending.shift()?.reject(
        new Error(
          "Combat DQN worker exited unexpectedly"
          + " code=" + String(code)
          + " signal=" + String(signal)
          + " "
          + describeCombatWorkerStderr(),
        ),
      );
    }
  });

  persistentCombatDqnWorker = worker;
  return worker;
}

async function inferCombatActionWithDqn(state: Record<string, unknown>, actionMask: number[]): Promise<number> {
  const worker = getOrStartPersistentCombatDqnWorker();
  const payload = JSON.stringify({ state, action_mask: actionMask }) + "\n";
  return await new Promise<number>((resolve, reject) => {
    worker.pending.push({ resolve, reject });
    worker.child.stdin.write(payload, "utf8", error => {
      if (!error) {
        return;
      }
      const pendingIndex = worker.pending.findIndex(entry => entry.resolve === resolve);
      if (pendingIndex >= 0) {
        worker.pending.splice(pendingIndex, 1);
      }
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function buildBattlerSnapshot(pokemon: any): BattlerSnapshot {
  return {
    species_id: pokemon.species.speciesId,
    species_name: SpeciesId[pokemon.species.speciesId] ?? String(pokemon.species.speciesId),
    level: pokemon.level,
    hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
  };
}

function bucketByThresholds(value: number, thresholds: number[]): number {
  for (let index = 0; index < thresholds.length; index += 1) {
    if (value <= thresholds[index]!) {
      return index;
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

function buildCombatObservation(game: GameManager): Record<string, unknown> {
  const player = game.scene.getPlayerPokemon();
  const enemy = game.scene.getEnemyPokemon();
  if (!player || !enemy) {
    throw new Error("Missing active battlers while building combat observation");
  }

  const playerTypes = player.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2);
  const enemyTypes = enemy.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2);
  const moveSet = player.getMoveset().slice(0, 4);
  const playerHpRatio = toHpRatio(player.hp, player.getMaxHp());
  const enemyHpRatio = toHpRatio(enemy.hp, enemy.getMaxHp());
  const speedAdvantage = speedOrderAdvantage(player, enemy);
  const knownEnemyPriorityThreat = enemyHasKnownPriorityThreat(enemy);
  const bestKnownEnemyPriority = getBestKnownEnemyPriority(enemy);

  const activeBestMoveEffectiveness = moveSet.reduce((best: number, move: any) => {
    const moveData = move.getMove();
    const [usable] = move.isUsable(player, false, true);
    if (!usable) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    return Math.max(best, Number.isFinite(effectiveness) ? effectiveness : 1);
  }, 0);

  const activeBestDamageRatio = moveSet.reduce((best: number, move: any) => {
    const moveData = move.getMove();
    const [usable] = move.isUsable(player, false, true);
    if (!usable) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const stab = playerTypes.includes(moveData.type) ? 1 : 0;
    return Math.max(best, estimateDamageRatio(player, enemy, moveData, effectiveness, stab));
  }, 0);

  const enemyBestDamageIntoActive = enemy.getMoveset().slice(0, 4).reduce((best: number, move: any) => {
    const moveData = move.getMove();
    const [usable] = move.isUsable(enemy, false, true);
    if (!usable) return best;
    const effectiveness = player.getMoveEffectiveness(enemy, moveData, false, true);
    const enemyStab = enemyTypes.includes(moveData.type) ? 1 : 0;
    return Math.max(best, estimateDamageRatio(enemy, player, moveData, effectiveness, enemyStab));
  }, 0);

  const moves = moveSet.map((move: any) => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    const ppRatio = ppMax > 0 ? ppLeft / ppMax : 0;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const stab = playerTypes.includes(moveData.type) ? 1 : 0;
    const [usable] = move.isUsable(player, false, true);
    const actsFirst = usable && actsFirstIfUsed(player, enemy, moveData, bestKnownEnemyPriority);
    const estimatedDamageRatio = estimateDamageRatio(player, enemy, moveData, effectiveness, stab);
    return {
      available: usable ? 1 : 0,
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
  for (let index = 0; index < moves.length; index += 1) {
    actionMask[index] = moves[index]!.available;
  }

  const party = game.scene.getPlayerParty();
  const switchableMembers: Array<{
    hpRatio: number;
    bestEffectiveness: number;
    bestDamageIntoEnemy: number;
    expectedIncomingDamage: number;
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

    const hpRatio = toHpRatio(member.hp, member.getMaxHp());
    const types = member.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2);
    const canSwitch = !member.isOnField() && !member.isFainted() && member.isAllowedInBattle();
    const bestDamageIntoEnemy = member.getMoveset().slice(0, 4).reduce((best: number, move: any) => {
      const moveData = move.getMove();
      const [usable] = move.isUsable(member, false, true);
      if (!usable) return best;
      const effectiveness = enemy.getMoveEffectiveness(member, moveData, false, true);
      const memberTypes = member.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2);
      const stab = memberTypes.includes(moveData.type) ? 1 : 0;
      return Math.max(best, estimateDamageRatio(member, enemy, moveData, effectiveness, stab));
    }, 0);
    const expectedIncomingDamage = enemy.getMoveset().slice(0, 4).reduce((best: number, move: any) => {
      const moveData = move.getMove();
      const [usable] = move.isUsable(enemy, false, true);
      if (!usable) return best;
      const effectiveness = member.getMoveEffectiveness(enemy, moveData, false, true);
      const stab = enemyTypes.includes(moveData.type) ? 1 : 0;
      return Math.max(best, estimateDamageRatio(enemy, member, moveData, effectiveness, stab));
    }, 0);
    const slotSpeedAdvantage = speedOrderAdvantage(member, enemy);
    const survivesOneHit = expectedIncomingDamage < hpRatio;
    const canThreatenKoBucket = koTurnsBucket(bestDamageIntoEnemy, enemyHpRatio);

    actionMask[MOVE_ACTIONS + slot] = canSwitch ? 1 : 0;
    if (canSwitch) {
      const bestEffectiveness = member.getMoveset().slice(0, 4).reduce((best: number, move: any) => {
        const moveData = move.getMove();
        const [usable] = move.isUsable(member, false, true);
        if (!usable) return best;
        const effectiveness = enemy.getMoveEffectiveness(member, moveData, false, true);
        return Math.max(best, Number.isFinite(effectiveness) ? effectiveness : 1);
      }, 0);
      switchableMembers.push({
        hpRatio,
        bestEffectiveness,
        bestDamageIntoEnemy,
        expectedIncomingDamage,
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
  const isTrainerBattle = battle?.trainer != null;
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

function buildMoveSnapshot(move: any): MoveSnapshot {
  const ppMax = move.getMovePp();
  return {
    move_id: move.moveId,
    move_name: MoveId[move.moveId] ?? String(move.moveId),
    pp_left: Math.max(0, ppMax - move.ppUsed),
    pp_max: ppMax,
  };
}

function buildPartyMemberDebugSnapshot(pokemon: any): PartyMemberDebugSnapshot {
  return {
    species_name: SpeciesId[pokemon.species.speciesId] ?? String(pokemon.species.speciesId),
    level: pokemon.level,
    hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
    fainted: pokemon.isFainted(),
    moves: pokemon.getMoveset().map((move: any) => buildMoveSnapshot(move)),
  };
}

function buildCombatDecisionSnapshot(
  game: GameManager,
  state: Record<string, unknown>,
  selectedAction: number,
  actionSource: string,
): CombatDecisionSnapshot {
  const playerPokemon = game.scene.getPlayerPokemon();
  const enemyPokemon = game.scene.getEnemyPokemon();

  if (!playerPokemon || !enemyPokemon) {
    throw new Error("Unable to build combat decision snapshot: missing battlers");
  }

  return {
    state,
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    is_double_battle: game.scene.currentBattle.double,
    player: buildBattlerSnapshot(playerPokemon),
    enemy: buildBattlerSnapshot(enemyPokemon),
    action_mask: Array.isArray(state.action_mask) ? [...(state.action_mask as number[])] : [],
    selected_action: selectedAction,
    action_source: actionSource,
  };
}

function getModifierHandler(game: GameManager): ModifierSelectUiHandler {
  const handler = game.scene.ui.handlers.find(h => h instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function getModifierTypeId(option: any): string {
  const modifierType = option.modifierTypeOption?.type;
  return modifierType?.id ?? modifierType?.name ?? modifierType?.constructor?.name ?? "unknown";
}

function toModifierOptionSnapshot(option: any, index: number): ModifierOptionSnapshot {
  const modifierType = option.modifierTypeOption?.type;
  return {
    index,
    modifier_type_id: getModifierTypeId(option),
    cost: option.modifierTypeOption.cost,
    upgrade_count: option.modifierTypeOption.upgradeCount,
    tier: modifierType?.tier ?? -1,
  };
}

function getPartyResourceFlags(game: GameManager): {
  hasMissingHp: boolean;
  hasFaintedPokemon: boolean;
  hasMissingPp: boolean;
} {
  const party = game.scene.getPlayerParty();
  return {
    hasMissingHp: party.some(pokemon => !pokemon.isFainted() && pokemon.hp < pokemon.getMaxHp()),
    hasFaintedPokemon: party.some(pokemon => pokemon.isFainted()),
    hasMissingPp: party.some(pokemon => pokemon.getMoveset().some((move: any) => move.ppUsed > 0)),
  };
}

function getActionAvailability(game: GameManager, option: any): { available: boolean; reason?: string } {
  const modifierTypeId = getModifierTypeId(option);
  const partyFlags = getPartyResourceFlags(game);
  const cost = option.modifierTypeOption?.cost ?? 0;

  if (cost > game.scene.money) {
    return { available: false, reason: "insufficient_money" };
  }
  if (modifierTypeId === "POTION" && !partyFlags.hasMissingHp) {
    return { available: false, reason: "no_injured_pokemon" };
  }
  if (modifierTypeId === "REVIVE" && !partyFlags.hasFaintedPokemon) {
    return { available: false, reason: "no_fainted_pokemon" };
  }
  if (modifierTypeId.includes("ETHER") && !partyFlags.hasMissingPp) {
    return { available: false, reason: "no_missing_pp" };
  }
  return { available: true };
}

function getActionExecutability(
  actionType: "take_reward" | "buy_shop_item",
  option: any,
): { executable: boolean; reason?: string; requiresPartyTarget?: boolean } {
  const modifierTypeId = getModifierTypeId(option);
  const modifierType = option?.modifierTypeOption?.type;
  if (actionType === "take_reward") {
    if (modifierTypeId === "MEMORY_MUSHROOM" || modifierType?.constructor?.name === "RememberMoveModifierType") {
      return { executable: false, reason: "remember_move_todo" };
    }
    if (modifierTypeId === "TERA_SHARD" || modifierType?.constructor?.name === "TerastallizeModifierType") {
      return { executable: false, reason: "tera_shard_todo" };
    }
    if (modifierTypeId === "DNA_SPLICERS" || modifierType?.constructor?.name === "FusePokemonModifierType") {
      return { executable: false, reason: "fuse_todo" };
    }
    if (
      modifierType?.constructor?.name === "FormChangeItemModifierType"
      && BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS.has(String(modifierTypeId))
    ) {
      return { executable: false, reason: "form_change_group2_todo" };
    }
    if (modifierTypeId.startsWith("TM")) {
      return { executable: false, reason: "tm_selection_todo" };
    }
    if (typeof modifierType?.moveSelectFilter === "function") {
      return { executable: false, reason: "requires_move_selection" };
    }
    if (typeof modifierType?.selectFilter === "function") {
      return { executable: true, requiresPartyTarget: true };
    }
    if (SAFE_REWARD_ACTION_IDS.has(modifierTypeId)) {
      return { executable: true };
    }
    return { executable: false, reason: "requires_followup_selection" };
  }

  return { executable: false, reason: "shop_item_execution_not_implemented" };
}

function getFirstValidPartyTargetIndex(game: GameManager): number {
  const partyHandler = game.scene.ui.getHandler() as any;
  const selectFilter = partyHandler?.selectFilter;
  const party = game.scene.getPlayerParty();

  for (let index = 0; index < party.length; index += 1) {
    const pokemon = party[index];
    if (!pokemon) {
      continue;
    }
    if (typeof selectFilter === "function") {
      const filterResult = selectFilter(pokemon);
      if (filterResult !== null && filterResult !== undefined) {
        continue;
      }
    }
    return index;
  }

  return -1;
}

function getRewardTargetAvailability(game: GameManager, option: any, targetIndex: number): { available: boolean; reason?: string } {
  const modifierType = option?.modifierTypeOption?.type;
  const modifierTypeId = getModifierTypeId(option);
  const selectFilter = modifierType?.selectFilter;
  const party = game.scene.getPlayerParty();
  const pokemon = party[targetIndex];

  if (!pokemon) {
    return { available: false, reason: "missing_party_target" };
  }
  if (typeof selectFilter !== "function") {
    return { available: true };
  }

  const filterResult = selectFilter(pokemon);
  if (filterResult === null || filterResult === undefined) {
    if (modifierType?.constructor?.name === "AttackTypeBoosterModifierType") {
      const moveType = modifierType.moveType as PokemonType | undefined;
      const hasMatchingStabAttackMove =
        typeof moveType === "number"
        && pokemon.isOfType(moveType, false)
        && pokemon
          .getMoveset(true)
          .some((pokemonMove: any) => pokemonMove?.getMove?.()?.is?.("AttackMove") && pokemonMove.getMove().type === moveType);

      if (!hasMatchingStabAttackMove) {
        return { available: false, reason: "no_stab_attack_move_for_booster" };
      }
    }

    if (modifierType?.constructor?.name === "SpeciesStatBoosterModifierType") {
      const eligibleSpecies = SPECIES_STAT_BOOSTER_ELIGIBLE_SPECIES[String(modifierTypeId)] ?? [];
      const speciesId = pokemon.getSpeciesForm(true).speciesId as SpeciesId;
      const fusionSpeciesId = pokemon.isFusion() ? (pokemon.getFusionSpeciesForm(true).speciesId as SpeciesId) : null;
      const matchesEligibleSpecies =
        eligibleSpecies.includes(speciesId)
        || (fusionSpeciesId !== null && eligibleSpecies.includes(fusionSpeciesId));

      if (!matchesEligibleSpecies) {
        return { available: false, reason: "wrong_species_for_species_booster" };
      }
    }

    return { available: true };
  }

  return { available: false, reason: String(filterResult) };
}

function buildModifierDecisionSnapshot(game: GameManager): ModifierDecisionSnapshot {
  const handler = getModifierHandler(game);
  const actions: ModifierActionSnapshot[] = [];
  const actionMask: number[] = [];

  handler.options.forEach((option, index) => {
    const executability = getActionExecutability("take_reward", option);
    if (executability.requiresPartyTarget) {
      game.scene.getPlayerParty().forEach((_pokemon: any, partyIndex: number) => {
        const availability = getRewardTargetAvailability(game, option, partyIndex);
        const available = availability.available && executability.executable;
        actions.push({
          action_index: actions.length,
          action_type: "take_reward",
          reward_index: index,
          target_party_index: partyIndex,
          modifier_type_id: getModifierTypeId(option),
          cost: option.modifierTypeOption?.cost ?? 0,
          available,
          executable: executability.executable,
          unavailable_reason: availability.reason,
          non_executable_reason: executability.reason,
        });
        actionMask.push(available ? 1 : 0);
      });
    } else {
      actions.push({
        action_index: actions.length,
        action_type: "take_reward",
        reward_index: index,
        modifier_type_id: getModifierTypeId(option),
        cost: option.modifierTypeOption?.cost ?? 0,
        available: true,
        executable: executability.executable,
        non_executable_reason: executability.reason,
      });
      actionMask.push(executability.executable ? 1 : 0);
    }
  });

  handler.shopOptionsRows.forEach((row, rowIndex) => {
    row.forEach((option, columnIndex) => {
      const availability = getActionAvailability(game, option);
      const executability = getActionExecutability("buy_shop_item", option);
      const available = availability.available && executability.executable;
      actions.push({
        action_index: actions.length,
        action_type: "buy_shop_item",
        shop_row_index: rowIndex,
        shop_column_index: columnIndex,
        modifier_type_id: getModifierTypeId(option),
        cost: option.modifierTypeOption?.cost ?? 0,
        available,
        executable: executability.executable,
        unavailable_reason: availability.reason,
        non_executable_reason: executability.reason,
      });
      actionMask.push(available ? 1 : 0);
    });
  });

  actions.push({
    action_index: actions.length,
    action_type: "skip",
    cost: 0,
    available: true,
    executable: true,
  });
  actionMask.push(1);

  return {
    wave_index: game.scene.currentBattle.waveIndex,
    reward_options: handler.options.map((option, index) => toModifierOptionSnapshot(option, index)),
    shop_rows: handler.shopOptionsRows.map(row => row.map((option, index) => toModifierOptionSnapshot(option, index))),
    actions,
    action_mask: actionMask,
  };
}

function getPartyOptionNames(handler: any): string[] {
  const rawOptions = Array.isArray(handler?.options) ? handler.options : [];
  return rawOptions.map((option: any) => {
    if (typeof option === "string") {
      return option;
    }
    if (typeof option === "number") {
      return String(option);
    }
    if (option?.label != null) {
      return String(option.label);
    }
    if (option?.name != null) {
      return String(option.name);
    }
    return String(option);
  });
}

function buildModifierPhaseLogSnapshot(game: GameManager): Record<string, unknown> {
  const decision = buildModifierDecisionSnapshot(game);
  return {
    wave_index: decision.wave_index,
    money: game.scene.money,
    reward_options: decision.reward_options,
    shop_rows: decision.shop_rows,
    actions: decision.actions,
    action_mask: decision.action_mask,
    party: game.scene.getPlayerParty().map((pokemon: any) => buildPartyMemberDebugSnapshot(pokemon)),
  };
}

function buildTimeoutDebugSnapshot(game: GameManager): TimeoutDebugSnapshot {
  const phaseName = game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown_phase";
  const uiModeValue = game.scene.ui.getMode();
  const uiModeName = UiMode[uiModeValue] ?? String(uiModeValue);
  const currentBattle = game.scene.currentBattle;
  const playerPokemon = game.scene.getPlayerPokemon?.() ?? null;
  const enemyPokemon = game.scene.getEnemyPokemon?.() ?? null;

  let rewardOptionIds: string[] = [];
  let shopOptionIds: string[][] = [];
  let partyUiMode: string | null = null;
  let partyCursor: number | null = null;
  try {
    const handler = getModifierHandler(game);
    rewardOptionIds = handler.options.map((option: any) => getModifierTypeId(option));
    shopOptionIds = handler.shopOptionsRows.map((row: any[]) => row.map((option: any) => getModifierTypeId(option)));
  } catch {
    rewardOptionIds = [];
    shopOptionIds = [];
  }

  const currentHandler = game.scene.ui.getHandler() as any;
  if (currentHandler && uiModeValue === UiMode.PARTY) {
    partyUiMode = currentHandler.partyUiMode != null ? String(currentHandler.partyUiMode) : null;
    partyCursor = Number.isInteger(currentHandler.cursor) ? currentHandler.cursor : null;
  }

  return {
    phase_name: phaseName,
    ui_mode: uiModeName,
    wave_index: currentBattle?.waveIndex ?? null,
    turn_index: currentBattle?.turn ?? null,
    combat_turn_count: currentBattle?.turn ?? null,
    money: game.scene.money ?? null,
    current_battle_double: currentBattle?.double ?? null,
    player_active_species: playerPokemon ? SpeciesId[playerPokemon.species.speciesId] ?? String(playerPokemon.species.speciesId) : null,
    enemy_active_species: enemyPokemon ? SpeciesId[enemyPokemon.species.speciesId] ?? String(enemyPokemon.species.speciesId) : null,
    reward_option_ids: rewardOptionIds,
    shop_option_ids: shopOptionIds,
    party_ui_mode: partyUiMode,
    party_cursor: partyCursor,
    party_options_mode: typeof currentHandler?.optionsMode === "boolean" ? currentHandler.optionsMode : null,
    party_options_cursor: Number.isInteger(currentHandler?.optionsCursor) ? currentHandler.optionsCursor : null,
    party_options: getPartyOptionNames(currentHandler),
    recent_messages: Array.isArray(game.textInterceptor?.logs) ? game.textInterceptor.logs.slice(-8) : [],
    party: game.scene.getPlayerParty().map((pokemon: any) => buildPartyMemberDebugSnapshot(pokemon)),
  };
}

function getMoveNameSafe(move: any): string {
  return move?.getName?.() ?? move?.name ?? MoveId[move?.moveId] ?? String(move?.moveId ?? "unknown");
}

function getMoveCategorySafe(move: any): number {
  return move?.category ?? move?.getCategory?.() ?? -1;
}

function getMovePowerSafe(move: any): number {
  return move?.power ?? move?.getPower?.() ?? 0;
}

function getMoveAccuracySafe(move: any): number {
  const accuracy = move?.accuracy ?? move?.getAccuracy?.();
  return typeof accuracy === "number" && accuracy > 0 ? accuracy : 100;
}

function getMovePpSafe(move: any): number {
  return move?.pp ?? move?.getMovePp?.() ?? 0;
}

function getMoveTypeSafe(move: any): number | null {
  return move?.type ?? move?.getType?.() ?? null;
}

function findWeakestMoveIndex(moves: any[], predicate: (move: any) => boolean): number {
  let lowestScore = Number.POSITIVE_INFINITY;
  let weakestIndex = -1;
  moves.forEach((move, index) => {
    if (!move || !predicate(move)) {
      return;
    }
    const score = getMovePowerSafe(move) * getMoveAccuracySafe(move);
    if (score < lowestScore) {
      lowestScore = score;
      weakestIndex = index;
    }
  });
  return weakestIndex;
}

function decideLearnMoveSlot(game: GameManager): number {
  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as any;
  const pokemon = currentPhase?.getPokemon?.() ?? game.scene.getPlayerPokemon?.();
  const moveId = currentPhase?.moveId;
  const newMove = moveId != null ? allMoves[moveId] : null;

  if (!pokemon || !newMove) {
    return 4;
  }

  const existingMoves = (pokemon.getMoveset?.() ?? []).filter((move: any) => move != null);
  if (existingMoves.length < 4) {
    return 4;
  }

  const species = pokemon.species;
  const type1 = species?.type1 ?? null;
  const type2 = species?.type2 ?? null;
  const newMoveCategory = getMoveCategorySafe(newMove);
  const newMovePower = getMovePowerSafe(newMove);
  const newMovePp = getMovePpSafe(newMove);
  const newMoveType = getMoveTypeSafe(newMove);
  const newMoveName = getMoveNameSafe(newMove);

  if (newMoveCategory === MoveCategory.STATUS || newMovePp === 5 || newMovePower <= 0 || newMoveName === "Belch") {
    return 4;
  }
  if (type2 != null && newMoveType != null && newMoveType !== type1 && newMoveType !== type2) {
    return 4;
  }

  const statusMoveIndex = existingMoves.findIndex((move: any) => getMoveCategorySafe(move) === MoveCategory.STATUS);
  if (statusMoveIndex >= 0) {
    return statusMoveIndex;
  }

  const countMovesOfType = (targetType: number | null): number =>
    targetType == null ? 0 : existingMoves.filter((move: any) => getMoveTypeSafe(move) === targetType).length;

  if (type2 != null) {
    if (newMoveType !== type1 && newMoveType !== type2) {
      return 4;
    }
    const countOfNewType = countMovesOfType(newMoveType);
    const replaceIndex = countOfNewType < 2
      ? findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) !== newMoveType)
      : findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) === newMoveType);
    return replaceIndex >= 0 ? replaceIndex : 4;
  }

  const ownTypeCount = countMovesOfType(type1);
  if (newMoveType === type1) {
    const replaceIndex = ownTypeCount < 2
      ? findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) !== type1)
      : findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) === type1);
    return replaceIndex >= 0 ? replaceIndex : 4;
  }

  if (ownTypeCount > 2) {
    const replaceIndex = findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) === type1);
    return replaceIndex >= 0 ? replaceIndex : 4;
  }

  const replaceIndex = findWeakestMoveIndex(existingMoves, move => getMoveTypeSafe(move) !== type1);
  return replaceIndex >= 0 ? replaceIndex : 4;
}

function resolveLearnMoveIfNeeded(game: GameManager): boolean {
  if (!game.isCurrentPhase("LearnMovePhase")) {
    return false;
  }

  const uiMode = game.scene.ui?.getMode?.();
  if (uiMode === UiMode.CONFIRM || uiMode === UiMode.MESSAGE || uiMode === UiMode.EVOLUTION_SCENE) {
    game.scene.ui.processInput(Button.ACTION);
    return true;
  }

  if (uiMode === UiMode.SUMMARY) {
    const moveSlot = decideLearnMoveSlot(game);
    game.scene.ui.setCursor(moveSlot);
    game.scene.ui.processInput(Button.ACTION);
    return true;
  }

  return false;
}

function advanceCurrentUiPromptIfPossible(game: GameManager): boolean {
  const uiMode = game.scene.ui?.getMode?.();
  if (uiMode !== UiMode.MESSAGE && uiMode !== UiMode.CONFIRM && uiMode !== UiMode.EVOLUTION_SCENE) {
    return false;
  }

  const handler = game.scene.ui.getHandler() as { processInput?: (button: Button) => boolean } | undefined;
  if (typeof handler?.processInput === "function") {
    handler.processInput(Button.ACTION);
    return true;
  }

  game.scene.ui.processInput(Button.ACTION);
  return true;
}

function sampleUniformAction(valid: number[]): number {
  return valid[Math.floor(Math.random() * valid.length)]!;
}

async function selectCombatActionFromMask(state: Record<string, unknown>, actionMask: number[]): Promise<{ action: number; actionSource: string }> {
  const valid = actionMask
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === 1)
    .map(entry => entry.index);

  if (valid.length === 0) {
    return { action: -1, actionSource: "no_valid_action" };
  }

  const action = await inferCombatActionWithDqn(state, actionMask);
  if (valid.includes(action)) {
    return { action, actionSource: "dqn" };
  }

  return { action: valid[0] ?? sampleUniformAction(valid), actionSource: "dqn_invalid_fallback_first_valid" };
}

function selectMoveByIndex(game: GameManager, actionIndex: number): void {
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

function selectSwitchByPartyIndex(game: GameManager, partyIndex: number): void {
  game.doSwitchPokemon(partyIndex);
}

function executeCombatAction(game: GameManager, action: number): void {
  if (action < MOVE_ACTIONS) {
    selectMoveByIndex(game, action);
    return;
  }

  selectSwitchByPartyIndex(game, action - MOVE_ACTIONS);
}

function hasRemainingPlayerTeam(game: GameManager): boolean {
  return game.scene.getPlayerParty().some(member => !member.isFainted() && member.isAllowedInBattle());
}

function isVictorySafe(game: GameManager): boolean {
  const battle = game.scene.currentBattle as any;
  if (!battle || !Array.isArray(battle.enemyParty)) {
    return false;
  }
  return battle.enemyParty.every((pokemon: any) => pokemon.isFainted());
}

function isCombatTerminalPhase(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase")
    || game.isCurrentPhase("PostGameOverPhase")
    || game.isCurrentPhase("TitlePhase")
    || game.isCurrentPhase("BattleEndPhase")
    || game.isCurrentPhase("SelectModifierPhase")
    || game.isCurrentPhase("EggLapsePhase");
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
  if (nextIndex < 0) {
    return "no_candidate";
  }

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

function hasLoggedTerminalPhaseSince(game: GameManager, fromIndex: number): boolean {
  const phaseLog = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log : [];
  const terminalPhaseNames = ["GameOverPhase", "PostGameOverPhase", "TitlePhase", "BattleEndPhase", "SelectModifierPhase", "EggLapsePhase"];
  for (let index = Math.max(0, fromIndex); index < phaseLog.length; index += 1) {
    if (terminalPhaseNames.includes(String(phaseLog[index]))) {
      return true;
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPromiseOrTerminal(
  game: GameManager,
  promise: Promise<unknown>,
  timeoutMs: number,
): Promise<"ok" | "terminal" | "timeout"> {
  let resolved = false;
  let failed = false;

  promise.then(() => {
    resolved = true;
  }).catch(() => {
    failed = true;
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (isCombatTerminalPhase(game)) {
      return "terminal";
    }
    if (resolved) {
      return "ok";
    }
    if (failed) {
      return isCombatTerminalPhase(game) ? "terminal" : "timeout";
    }
    await sleep(25);
  }

  return isCombatTerminalPhase(game) ? "terminal" : "timeout";
}

async function waitForCommandOrTerminalAfterForcedSwitch(game: GameManager, timeoutMs: number): Promise<"ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (isCombatTerminalPhase(game)) {
      return "terminal";
    }
    if (game.isCurrentPhase("CommandPhase")) {
      return "ok";
    }
    await sleep(25);
  }
  return isCombatTerminalPhase(game) ? "terminal" : "timeout";
}

async function advanceCombatAfterAction(game: GameManager): Promise<"ok" | "terminal" | "timeout"> {
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
  if (isCombatTerminalPhase(game)) {
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
  const nextTurnPromise = game.toNextTurn(terminalPhasesForTurnAdvance)
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
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (nextTurnTerminal || isCombatTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
      return "terminal";
    }
    if (nextTurnResolved) {
      return "ok";
    }
    if (nextTurnFailed) {
      return isCombatTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart) ? "terminal" : "timeout";
    }
    await sleep(25);
  }

  if (isCombatTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
    return "terminal";
  }
  void nextTurnPromise;
  return "timeout";
}

async function waitForModifierInputReady(game: GameManager, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const handler = getModifierHandler(game) as any;
    if (handler.awaitingActionInput === true) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for modifier input readiness");
}

async function waitForUiMode(game: GameManager, mode: UiMode, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (game.scene.ui.getMode() === mode) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for UI mode ${UiMode[mode] ?? mode}`);
}

async function waitForModifierRewardFollowupMode(
  game: GameManager,
  timeoutMs = 2000,
): Promise<UiMode> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const mode = game.scene.ui.getMode();
    if (mode !== UiMode.MODIFIER_SELECT) {
      return mode;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return game.scene.ui.getMode();
}

async function executeSkipAction(game: GameManager): Promise<void> {
  await waitForModifierInputReady(game);
  const handler = getModifierHandler(game);
  handler.processInput(Button.CANCEL);
  await waitForUiMode(game, UiMode.CONFIRM);
  const confirmHandler = game.scene.ui.getHandler() as { processInput?: (button: Button) => boolean } | undefined;
  if (typeof confirmHandler?.processInput !== "function") {
    throw new Error("Confirm handler does not support processInput");
  }
  confirmHandler.processInput(Button.ACTION);
  await game.phaseInterceptor.to("CommandPhase");
}

function toRewardRowCursor(): number {
  return ShopCursorTarget.REWARDS;
}

async function executeTakeRewardAction(game: GameManager, rewardIndex: number, targetPartyIndex?: number): Promise<void> {
  await waitForModifierInputReady(game);
  const handler = getModifierHandler(game);
  handler.setRowCursor(toRewardRowCursor());
  handler.setCursor(rewardIndex);
  handler.processInput(Button.ACTION);

  const followupMode = await waitForModifierRewardFollowupMode(game);
  console.error(
    `[modifier-fixed-seed-reward] after_select wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} ui=${UiMode[followupMode] ?? followupMode} reward_index=${rewardIndex}`,
  );

  if (followupMode === UiMode.PARTY) {
    await waitForUiMode(game, UiMode.PARTY);
    const partyHandler = game.scene.ui.getHandler() as any;
    const partyUiMode = partyHandler?.partyUiMode;

    if (partyUiMode === PartyUiMode.MODIFIER) {
      const targetIndex = targetPartyIndex ?? getFirstValidPartyTargetIndex(game);
      if (targetIndex < 0) {
        throw new Error("No valid party target for modifier reward");
      }

      if (typeof partyHandler?.setCursor !== "function" || typeof partyHandler?.processInput !== "function") {
        throw new Error("Party handler does not support cursor/action flow for modifier reward");
      }

      partyHandler.setCursor(targetIndex);
      console.error(
        JSON.stringify({
          event: "modifier_fixed_seed_party_before_apply",
          wave_index: game.scene.currentBattle?.waveIndex ?? null,
          target_index: targetIndex,
          party_ui_mode: partyHandler?.partyUiMode ?? null,
          cursor: partyHandler?.cursor ?? null,
          options_mode: partyHandler?.optionsMode ?? null,
          options_cursor: partyHandler?.optionsCursor ?? null,
          options: getPartyOptionNames(partyHandler),
        }),
      );
      const firstActionResult = partyHandler.processInput(Button.ACTION);
      console.error(
        JSON.stringify({
          event: "modifier_fixed_seed_party_after_first_action",
          wave_index: game.scene.currentBattle?.waveIndex ?? null,
          target_index: targetIndex,
          result: firstActionResult,
          cursor: partyHandler?.cursor ?? null,
          options_mode: partyHandler?.optionsMode ?? null,
          options_cursor: partyHandler?.optionsCursor ?? null,
          options: getPartyOptionNames(partyHandler),
        }),
      );
      const secondActionResult = partyHandler.processInput(Button.ACTION);
      console.error(
        JSON.stringify({
          event: "modifier_fixed_seed_party_after_second_action",
          wave_index: game.scene.currentBattle?.waveIndex ?? null,
          target_index: targetIndex,
          result: secondActionResult,
          cursor: partyHandler?.cursor ?? null,
          options_mode: partyHandler?.optionsMode ?? null,
          options_cursor: partyHandler?.optionsCursor ?? null,
          options: getPartyOptionNames(partyHandler),
          ui_mode: UiMode[game.scene.ui.getMode()] ?? game.scene.ui.getMode(),
        }),
      );
    } else {
      throw new Error(`Unsupported party ui mode for reward execution: ${String(partyUiMode)}`);
    }
  }

  await game.phaseInterceptor.to("CommandPhase");
}

async function executeModifierAction(game: GameManager, action: ModifierActionSnapshot): Promise<void> {
  switch (action.action_type) {
    case "skip":
      await executeSkipAction(game);
      return;
    case "take_reward":
      if (action.reward_index == null) {
        throw new Error("Reward action missing reward_index");
      }
      await executeTakeRewardAction(game, action.reward_index, action.target_party_index);
      return;
    case "buy_shop_item":
      throw new Error("Shop item execution not implemented yet");
  }
}

function pickRandomExecutableAction(
  decision: ModifierDecisionSnapshot,
  random: () => number,
): ModifierActionSnapshot {
  const candidates = decision.actions.filter(action => action.available && action.executable);
  if (candidates.length === 0) {
    throw new Error("No executable modifier actions available");
  }
  const index = Math.floor(random() * candidates.length);
  return candidates[index]!;
}

function calculateImmediateReward(
  decision: ModifierDecisionSnapshot,
  selectedAction: ModifierActionSnapshot,
  game: GameManager,
): number {
  let reward = 0;
  const partyFlags = getPartyResourceFlags(game);
  const hasFreeRewards = decision.reward_options.length > 0;

  if (selectedAction.action_type === "skip") {
    if (partyFlags.hasMissingHp) {
      reward -= 1.0;
    }
    if (hasFreeRewards) {
      reward -= 0.5;
    }
  }

  if (selectedAction.action_type === "take_reward") {
    reward += 0.1;
  }

  if (selectedAction.modifier_type_id === "POTION" && partyFlags.hasMissingHp) {
    reward += 1.0;
  }

  return reward;
}

function calculateTerminalReward(waveReached: number): number {
  return waveReached.toString() === "NaN" ? 0 : waveReached;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`step_timeout:${label}:${timeoutMs}`)), timeoutMs);
    }),
  ]);
}

function applyWaveLibW1StarterLayout(game: GameManager): void {
  const party = game.scene.getPlayerParty();
  for (const starterConfig of WAVE_LIB_W1_STARTERS) {
    const pokemon = party.find(candidate => candidate.species.speciesId === starterConfig.speciesId);
    if (!pokemon) {
      throw new Error(`Missing starter species in party: ${SpeciesId[starterConfig.speciesId]}`);
    }

    pokemon.level = starterConfig.level;
    pokemon.ivs = [...starterConfig.ivs];
    pokemon.abilityIndex = 0;
    pokemon.setNature(starterConfig.nature);
    pokemon.tryPopulateMoveset(starterConfig.moveset, true);
    pokemon.getMoveset().forEach(move => {
      move.ppUsed = 0;
    });
    pokemon.calculateStats();
    pokemon.hp = pokemon.getMaxHp();
  }
}

describe("modifier fixed seed collector", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    cleanupPersistentCombatDqnWorker();
  });

  it("collects repeated fixed-seed modifier runs", async () => {
    const episodes: EpisodeRecord[] = [];

    for (let runIndex = 0; runIndex < RUN_COUNT; runIndex += 1) {
      const game = new GameManager(phaserGame);
      vi.spyOn(game.scene, "getDoubleBattleChance").mockReturnValue(Number.MAX_SAFE_INTEGER);

      game.override
        .seed(SEED)
        .disableTrainerWaves()
        .enemySpecies(SpeciesId.MAGIKARP)
        .enemyMoveset(MoveId.SPLASH);

      const random = createDeterministicRandom(`${SEED}::${runIndex}`);
      const steps: ModifierStepRecord[] = [];
      let completedWaves = 0;
      let terminationReason = "unknown";
      let timeoutDebug: TimeoutDebugSnapshot | undefined;
      let selectedModifierActionForDebug: ModifierActionSnapshot | undefined;
      const runStartedAt = Date.now();

      try {
        await game.classicMode.startBattle(STARTER_SPECIES);
        applyWaveLibW1StarterLayout(game);

        while (completedWaves < MAX_WAVES) {
          const combatTurns: CombatDecisionSnapshot[] = [];
          while (!game.isCurrentPhase("SelectModifierPhase")) {
            const currentBattle = game.scene.currentBattle;
            if (!currentBattle) {
              terminationReason = "missing_current_battle";
              break;
            }
            if ((currentBattle.turn ?? 0) > MAX_COMBAT_TURNS_PER_WAVE) {
              throw new Error(`step_timeout:combat_turn_limit:${MAX_COMBAT_TURNS_PER_WAVE}`);
            }
            if (currentBattle.double) {
              terminationReason = "double_battle_not_supported";
              break;
            }
            if (!game.isCurrentPhase("CommandPhase")) {
              throw new Error(`unexpected_combat_phase:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`);
            }

            const combatState = buildStateFromSnapshot(game);
            const actionMask = Array.isArray(combatState.action_mask)
              ? (combatState.action_mask as number[])
              : [];
            const { action, actionSource } = await selectCombatActionFromMask(combatState, actionMask);
            if (action < 0) {
              terminationReason = "no_valid_combat_action";
              break;
            }

            combatTurns.push(buildCombatDecisionSnapshot(game, combatState, action, actionSource));
            executeCombatAction(game, action);

            const advanceStatus = await withTimeout(advanceCombatAfterAction(game), STEP_TIMEOUT_MS, "advance_combat_after_action");
            if (advanceStatus === "timeout") {
              throw new Error(`step_timeout:advance_combat_after_action:${STEP_TIMEOUT_MS}`);
            }
            if (advanceStatus === "terminal" && !game.isCurrentPhase("SelectModifierPhase")) {
              if (game.isCurrentPhase("BattleEndPhase")) {
                const completedWaveIndex = game.scene.currentBattle?.waveIndex ?? 0;
                if (completedWaveIndex > 0 && completedWaveIndex % 10 === 0) {
                  await withTimeout(
                    game.phaseInterceptor.to("CommandPhase"),
                    STEP_TIMEOUT_MS,
                    "battle_end_to_next_battle_command_phase",
                  );
                  completedWaves += 1;
                  continue;
                }

                await withTimeout(
                  game.phaseInterceptor.to("SelectModifierPhase"),
                  STEP_TIMEOUT_MS,
                  "battle_end_to_select_modifier_phase",
                );
                if (game.isCurrentPhase("SelectModifierPhase")) {
                  break;
                }
                terminationReason = `expected_select_modifier_phase_but_got:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                break;
              }
              if (game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("PostGameOverPhase") || game.isCurrentPhase("TitlePhase")) {
                terminationReason = "team_wipe_or_game_over";
              } else {
                terminationReason = `combat_terminal:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
              }
              break;
            }
          }

          if (terminationReason !== "unknown") {
            break;
          }
          if (!game.isCurrentPhase("SelectModifierPhase")) {
            terminationReason = `expected_select_modifier_phase_but_got:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
            break;
          }

          console.error(
            `[modifier-fixed-seed-shop] run=${runIndex} wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} ${JSON.stringify(buildModifierPhaseLogSnapshot(game))}`,
          );

          const modifierDecision = buildModifierDecisionSnapshot(game);
          expect(MODIFIER_POLICY).toBe("random_executable");
          const selectedAction = pickRandomExecutableAction(modifierDecision, random);
          selectedModifierActionForDebug = selectedAction;
          const immediateReward = calculateImmediateReward(modifierDecision, selectedAction, game);

          steps.push({
            wave_index: modifierDecision.wave_index,
            combat_turns: combatTurns,
            modifier_decision: modifierDecision,
            selected_action: selectedAction,
            immediate_reward: immediateReward,
          });

          await withTimeout(executeModifierAction(game, selectedAction), STEP_TIMEOUT_MS, "execute_modifier_action");
          completedWaves += 1;
        }

        if (terminationReason === "unknown") {
          terminationReason = completedWaves >= MAX_WAVES ? "max_waves_reached" : "episode_loop_ended";
        }
      } catch (error) {
        if (terminationReason === "unknown") {
          terminationReason = error instanceof Error ? error.message : String(error);
        }
        if (terminationReason.startsWith("step_timeout:")) {
          timeoutDebug = buildTimeoutDebugSnapshot(game);
          if (selectedModifierActionForDebug) {
            timeoutDebug.selected_modifier_action = {
              action_index: selectedModifierActionForDebug.action_index,
              action_type: selectedModifierActionForDebug.action_type,
              modifier_type_id: selectedModifierActionForDebug.modifier_type_id,
              reward_index: selectedModifierActionForDebug.reward_index,
              target_party_index: selectedModifierActionForDebug.target_party_index,
              shop_row_index: selectedModifierActionForDebug.shop_row_index,
              shop_column_index: selectedModifierActionForDebug.shop_column_index,
              cost: selectedModifierActionForDebug.cost,
            };
          }
          console.error(
            `[modifier-fixed-seed-timeout] run=${runIndex} wave=${timeoutDebug.wave_index} phase=${timeoutDebug.phase_name} ui=${timeoutDebug.ui_mode} reason=${terminationReason}`,
          );
          console.error(JSON.stringify(timeoutDebug));
        }
      } finally {
        game.phaseInterceptor.restoreOg();
      }

      const waveReached = completedWaves;
      const runtimeMs = Date.now() - runStartedAt;
      const localRewardSum = steps.reduce((sum, step) => sum + step.immediate_reward, 0);
      const terminalReward = calculateTerminalReward(waveReached);
      episodes.push({
        run_index: runIndex,
        seed: SEED,
        max_waves: MAX_WAVES,
        modifier_policy: MODIFIER_POLICY,
        runtime_ms: runtimeMs,
        completed_waves: completedWaves,
        wave_reached: waveReached,
        termination_reason: terminationReason,
        local_reward_sum: localRewardSum,
        terminal_reward: terminalReward,
        total_reward: localRewardSum + terminalReward,
        steps,
        timeout_debug: timeoutDebug,
      });
    }

    const averageWaveReached = episodes.reduce((sum, episode) => sum + episode.wave_reached, 0) / episodes.length;
    const averageTotalReward = episodes.reduce((sum, episode) => sum + episode.total_reward, 0) / episodes.length;

    const payload = {
      seed: SEED,
      run_count: RUN_COUNT,
      max_waves: MAX_WAVES,
      step_timeout_ms: STEP_TIMEOUT_MS,
      modifier_policy: MODIFIER_POLICY,
      combat_dqn_checkpoint: COMBAT_DQN_CHECKPOINT,
      combat_dqn_device: COMBAT_DQN_DEVICE,
      generated_at: new Date().toISOString(),
      summary: {
        average_wave_reached: averageWaveReached,
        average_total_reward: averageTotalReward,
        best_wave_reached: Math.max(...episodes.map(episode => episode.wave_reached)),
        worst_wave_reached: Math.min(...episodes.map(episode => episode.wave_reached)),
      },
      episodes,
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), { encoding: "utf8" });
  }, Math.max(300000, RUN_COUNT * STEP_TIMEOUT_MS * 3));
});
