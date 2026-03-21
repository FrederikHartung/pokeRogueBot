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
import { getMoveTargets } from "#moves/move-utils";
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
type CollectorVariant = "sanity_masking" | "strategic_fixed_seed";
const SCHEMA_VERSION = "modifier_strategic_fixed_seed_output_v1";
const STARTER_CONFIG_ID = "wave_lib_w1_starters_v1";
const WORKER_ID = process.env.POKEROGUE_COLLECTOR_WORKER_ID ?? "local-worker-0";

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
  battle_type?: "single" | "double";
  acting_field_index?: number;
  player: BattlerSnapshot;
  enemy: BattlerSnapshot;
  ally_field?: BattlerSnapshot[];
  enemy_field?: BattlerSnapshot[];
  action_mask: number[];
  selected_action: number;
  action_source: string;
}

interface DoubleSlotActionSnapshot {
  action_index: number;
  action_kind: "move" | "switch";
  acting_field_index: number;
  move_index?: number;
  move_id?: number;
  target_index?: BattlerIndex;
  selected_targets?: BattlerIndex[];
  expects_select_target_phase?: boolean;
  uses_struggle_fallback?: boolean;
  switch_party_index?: number;
  score: number;
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
  step_index: number;
  worker_id: string;
  decision_rng_seed: string;
  wave_index: number;
  combat_turns: CombatDecisionSnapshot[];
  modifier_decision: ModifierDecisionSnapshot;
  selected_action: ModifierActionSnapshot;
  selected_action_valid: boolean;
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
  command_field_index?: number | null;
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
  schema_version: string;
  run_index: number;
  worker_id: string;
  decision_rng_seed: string;
  seed: string;
  max_waves: number;
  collector_variant: CollectorVariant;
  modifier_policy: ModifierPolicy;
  runtime_ms: number;
  completed_waves: number;
  wave_reached: number;
  termination_reason: string;
  local_reward_sum: number;
  terminal_reward: number;
  total_reward: number;
  steps: ModifierStepRecord[];
  retry_count?: number;
  timeout_debug?: TimeoutDebugSnapshot;
  error_debug?: TimeoutDebugSnapshot;
  error_stack?: string;
}

const OUTPUT_PATH = __OUTPUT_PATH__;
const SEED = __SEED__;
const RUN_COUNT = __RUN_COUNT__;
const RUN_INDEX_OFFSET = __RUN_INDEX_OFFSET__;
const MAX_WAVES = __MAX_WAVES__;
const COLLECTOR_VARIANT = __COLLECTOR_VARIANT__ as CollectorVariant;
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
// Central offline policy for SelectModifierPhase reward actions.
// Reward actions are either:
// - explicitly blocked for the current offline DQN setup,
// - allowed as direct no-target actions,
// - allowed as party-target actions via selectFilter-based target masking,
// - or still unsupported because they require move/multi-step follow-up selection.
const OFFLINE_BLOCKED_REWARD_IDS = new Set([
  "MAP",
  "MEMORY_MUSHROOM",
  "DNA_SPLICERS",
  "TERA_SHARD",
  "TERA_ORB",
  "MEGA_BRACELET",
  "DYNAMAX_BAND",
  "LOCK_CAPSULE",
  "VOUCHER",
  "VOUCHER_PLUS",
  "VOUCHER_PREMIUM",
  "IV_SCANNER",
  "SHINY_CHARM",
  "HEALING_CHARM",
  "ABILITY_CHARM",
  "CATCHING_CHARM",
  "EVIOLITE",
  "LEEK",
  "TOXIC_ORB",
  "FLAME_ORB",
  "BATON",
  "SOUL_DEW",
]);
const OFFLINE_ALLOWED_DIRECT_REWARD_IDS = new Set([
  "LURE",
  "SUPER_LURE",
  "MAX_LURE",
  "POKEBALL",
  "GREAT_BALL",
  "ULTRA_BALL",
  "ROGUE_BALL",
  "MASTER_BALL",
  "BERRY",
  "SACRED_ASH",
  "RARER_CANDY",
  "TEMP_STAT_STAGE_BOOSTER",
  "DIRE_HIT",
  "NUGGET",
  "BIG_NUGGET",
  "RELIC_GOLD",
  "AMULET_COIN",
  "CANDY_JAR",
  "EXP_CHARM",
  "SUPER_EXP_CHARM",
  "EXP_SHARE",
  "BERRY_POUCH",
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
const OFFLINE_BLOCKED_MODIFIER_TYPE_NAMES = new Set([
  "RememberMoveModifierType",
  "TerastallizeModifierType",
  "FusePokemonModifierType",
]);

interface PersistentExternalPolicyWorker {
  child: ReturnType<typeof spawn>;
  readline: Interface;
  pending: Array<{ resolve: (action: number) => void; reject: (error: Error) => void }>;
  stderrChunks: string[];
  key: string;
}

const persistentExternalPolicyWorkers = new Map<string, PersistentExternalPolicyWorker>();

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

function isTransientStartupMysteryEncounterError(
  terminationReason: string,
  waveReached: number,
  steps: ModifierStepRecord[],
): boolean {
  return (
    terminationReason.includes("mysteryEncounter")
    && waveReached === 0
    && steps.length === 0
  );
}

function shouldRetryRun(
  terminationReason: string,
  waveReached: number,
  steps: ModifierStepRecord[],
  attemptIndex: number,
): boolean {
  if (attemptIndex >= 1) {
    return false;
  }
  return isTransientStartupMysteryEncounterError(terminationReason, waveReached, steps);
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

function externalPolicyKey(policyConfig: {
  command: string[];
  env?: Record<string, string>;
  timeout_ms?: number;
  persistent?: boolean;
}): string {
  return JSON.stringify({
    command: Array.isArray(policyConfig?.command) ? policyConfig.command : [],
    env: typeof policyConfig?.env === "object" && policyConfig.env !== null ? policyConfig.env : {},
    timeout_ms: Number.isFinite(policyConfig?.timeout_ms) ? policyConfig.timeout_ms : null,
    persistent: policyConfig?.persistent === true,
  });
}

function describeWorkerStderr(worker: PersistentExternalPolicyWorker | null): string {
  if (!worker || worker.stderrChunks.length === 0) {
    return "";
  }
  return worker.stderrChunks.join("");
}

function cleanupPersistentExternalPolicyWorkers(): void {
  for (const worker of persistentExternalPolicyWorkers.values()) {
    while (worker.pending.length > 0) {
      worker.pending.shift()?.reject(new Error("Persistent external policy worker was cleaned up"));
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
  persistentExternalPolicyWorkers.clear();
}

function getOrStartPersistentExternalPolicyWorker(policyConfig: {
  command: string[];
  env?: Record<string, string>;
  timeout_ms?: number;
  persistent?: boolean;
}): PersistentExternalPolicyWorker {
  const key = externalPolicyKey(policyConfig);
  const existing = persistentExternalPolicyWorkers.get(key);
  if (existing) {
    return existing;
  }

  if (!Array.isArray(policyConfig?.command) || policyConfig.command.length === 0) {
    throw new Error("POLICY.command must be a non-empty string array for external_command");
  }

  const pythonRelatedEnv = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => /^(PYTHON|VIRTUAL_ENV|CONDA|TORCH|PYTORCH|PYTHONHOME|PYTHONPATH|DYLD|LD_)/.test(key)),
  );
  console.error(
    `[modifier-fixed-seed-single-dqn-worker-start] cwd=${process.cwd()} command=${JSON.stringify(policyConfig.command)} env=${JSON.stringify(pythonRelatedEnv)}`,
  );

  const [command, ...args] = policyConfig.command;
  const env = typeof policyConfig?.env === "object" && policyConfig.env !== null
    ? { ...process.env, ...policyConfig.env }
    : process.env;
  const child = spawn(
    command,
    args,
    {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    },
  );
  const readline = createInterface({ input: child.stdout });
  const worker: PersistentExternalPolicyWorker = {
    key,
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

async function runPersistentExternalPolicy(
  policyConfig: {
    command: string[];
    env?: Record<string, string>;
    timeout_ms?: number;
    persistent?: boolean;
  },
  state: Record<string, unknown>,
  actionMask: number[],
): Promise<number> {
  const worker = getOrStartPersistentExternalPolicyWorker(policyConfig);
  const timeoutMs = Number.isFinite(policyConfig?.timeout_ms) && policyConfig.timeout_ms! > 0
    ? Number(policyConfig.timeout_ms)
    : 5000;
  const payload = JSON.stringify({ state, action_mask: actionMask }) + "\n";

  return await withTimeout(
    new Promise<number>((resolve, reject) => {
      worker.pending.push({ resolve, reject });
      worker.child.stdin.write(payload, "utf8", (error: Error | null | undefined) => {
        if (!error) {
          return;
        }
        const pendingIndex = worker.pending.findIndex(entry => entry.resolve === resolve);
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

async function inferCombatActionWithDqn(state: Record<string, unknown>, actionMask: number[]): Promise<number> {
  return await runPersistentExternalPolicy(
    {
      command: [
        COMBAT_DQN_PYTHON,
        COMBAT_DQN_WORKER_SCRIPT,
        "--checkpoint",
        COMBAT_DQN_CHECKPOINT,
        "--device",
        COMBAT_DQN_DEVICE,
      ],
      persistent: true,
      timeout_ms: STEP_TIMEOUT_MS,
    },
    state,
    actionMask,
  );
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

function buildActiveBattlerState(pokemon: any, canAct = true): Record<string, unknown> {
  if (!pokemon) {
    return {
      present: 0,
      species_id: 0,
      hp_ratio: 0,
      fainted: 0,
      level: 0,
      types: [],
      can_act: 0,
    };
  }

  return {
    present: 1,
    species_id: pokemon.species?.speciesId ?? 0,
    hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
    fainted: pokemon.isFainted() ? 1 : 0,
    level: pokemon.level ?? 0,
    types: pokemon.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2),
    can_act: canAct && !pokemon.isFainted() ? 1 : 0,
  };
}

function getCommandFieldIndexSafe(game: GameManager): number {
  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as { getFieldIndex?: () => number } | undefined;
  if (typeof currentPhase?.getFieldIndex === "function") {
    const fieldIndex = currentPhase.getFieldIndex();
    if (Number.isInteger(fieldIndex)) {
      return fieldIndex;
    }
  }
  return 0;
}

function getActingPlayerPokemon(game: GameManager): any | undefined {
  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as { getPokemon?: () => any } | undefined;
  if (typeof currentPhase?.getPokemon === "function") {
    return currentPhase.getPokemon();
  }
  const playerField = game.scene.getPlayerField(true);
  return playerField[getCommandFieldIndexSafe(game)] ?? playerField[0];
}

function getPrimaryEnemyTarget(game: GameManager): any | undefined {
  const activeEnemies = game.scene.getEnemyField(true);
  return activeEnemies[0];
}

function isEnemyBattlerIndex(targetIndex: BattlerIndex): boolean {
  return targetIndex === BattlerIndex.ENEMY || targetIndex === BattlerIndex.ENEMY_2;
}

function buildDoubleCombatObservation(game: GameManager): Record<string, unknown> {
  const battle = game.scene.currentBattle;
  const playerField = game.scene.getPlayerField(true);
  const enemyField = game.scene.getEnemyField(true);
  const actingFieldIndex = getCommandFieldIndexSafe(game);
  const actingPokemon = getActingPlayerPokemon(game);
  const activeEnemy = getPrimaryEnemyTarget(game);
  const party = game.scene.getPlayerParty();

  return {
    battle_type: "double",
    wave_index: battle?.waveIndex ?? 0,
    turn_index: battle?.turn ?? 0,
    is_trainer_battle: battle?.trainer != null ? 1 : 0,
    acting_field_index: actingFieldIndex,
    ally_active: [
      buildActiveBattlerState(playerField[0], actingFieldIndex === 0),
      buildActiveBattlerState(playerField[1], actingFieldIndex === 1),
    ],
    enemy_active: [
      buildActiveBattlerState(enemyField[0], false),
      buildActiveBattlerState(enemyField[1], false),
    ],
    bench_slots: Array.from({ length: 6 }, (_, slot) => {
      const member = party[slot];
      if (!member) {
        return {
          present: 0,
          fainted: 0,
          hp_ratio: 0,
          level: 0,
          types: [],
          legal_switch_target: 0,
        };
      }
      return {
        present: 1,
        fainted: member.isFainted() ? 1 : 0,
        hp_ratio: toHpRatio(member.hp, member.getMaxHp()),
        level: member.level ?? 0,
        types: member.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2),
        legal_switch_target: !member.isFainted() && !member.isOnField() && member.isAllowedInBattle() ? 1 : 0,
      };
    }),
    requires_forced_switch: game.isCurrentPhase("SwitchPhase") ? 1 : 0,
    forced_switch_slots: [
      game.isCurrentPhase("SwitchPhase") && actingFieldIndex === 0 ? 1 : 0,
      game.isCurrentPhase("SwitchPhase") && actingFieldIndex === 1 ? 1 : 0,
    ],
    acting_pokemon_species_id: actingPokemon?.species?.speciesId ?? 0,
    primary_enemy_species_id: activeEnemy?.species?.speciesId ?? 0,
  };
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
  preparedPlayerSnapshot?: BattlerSnapshot,
  preparedEnemySnapshot?: BattlerSnapshot,
  actionMaskOverride?: number[],
): CombatDecisionSnapshot {
  const snapshotActionMask = actionMaskOverride
    ? [...actionMaskOverride]
    : Array.isArray(state.action_mask)
      ? [...(state.action_mask as number[])]
      : [];
  const snapshotState = actionMaskOverride
    ? {
      ...state,
      action_mask: snapshotActionMask,
    }
    : state;
  const playerSnapshot = preparedPlayerSnapshot
    ?? (() => {
      const playerPokemon = game.scene.getPlayerPokemon();
      return playerPokemon ? buildBattlerSnapshot(playerPokemon) : null;
    })();
  const enemySnapshot = preparedEnemySnapshot
    ?? (() => {
      const enemyPokemon = game.scene.getEnemyPokemon();
      return enemyPokemon ? buildBattlerSnapshot(enemyPokemon) : null;
    })();

  if (!playerSnapshot || !enemySnapshot) {
    throw new Error("Unable to build combat decision snapshot: missing battlers");
  }

  return {
    state: snapshotState,
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    is_double_battle: game.scene.currentBattle.double,
    player: playerSnapshot,
    enemy: enemySnapshot,
    action_mask: snapshotActionMask,
    selected_action: selectedAction,
    action_source: actionSource,
  };
}

function buildDoubleCombatDecisionSnapshot(
  game: GameManager,
  state: Record<string, unknown>,
  selectedAction: DoubleSlotActionSnapshot,
  actionMask: number[],
  actionSource: string,
): CombatDecisionSnapshot {
  const playerField = game.scene.getPlayerField(true);
  const enemyField = game.scene.getEnemyField(true);
  const actingPokemon = getActingPlayerPokemon(game);
  const primaryEnemy = getPrimaryEnemyTarget(game);

  if (!actingPokemon || !primaryEnemy) {
    throw new Error("Unable to build double combat decision snapshot: missing battlers");
  }

  return {
    state,
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    is_double_battle: true,
    battle_type: "double",
    acting_field_index: selectedAction.acting_field_index,
    player: buildBattlerSnapshot(actingPokemon),
    enemy: buildBattlerSnapshot(primaryEnemy),
    ally_field: playerField.map(pokemon => buildBattlerSnapshot(pokemon)),
    enemy_field: enemyField.map(pokemon => buildBattlerSnapshot(pokemon)),
    action_mask: [...actionMask],
    selected_action: selectedAction.action_index,
    action_source: actionSource,
  };
}

function estimateDoubleActionScore(user: any, target: any, moveData: any): number {
  if (!user || !moveData) {
    return 0;
  }
  if (!target) {
    if (moveData.category === MoveCategory.STATUS) {
      return 0.05;
    }
    return 0.1;
  }
  const userTypes = user.getTypes(true, true).filter((type: number) => Number.isInteger(type) && type >= 0).slice(0, 2);
  const effectiveness = target.getMoveEffectiveness(user, moveData, false, true);
  const stab = userTypes.includes(moveData.type) ? 1 : 0;
  return estimateDamageRatio(user, target, moveData, effectiveness, stab);
}

function buildDoubleSlotActions(game: GameManager): DoubleSlotActionSnapshot[] {
  const actingFieldIndex = getCommandFieldIndexSafe(game);
  const actingPokemon = getActingPlayerPokemon(game);
  if (!actingPokemon) {
    console.error(
      `[modifier-fixed-seed-double-actions-empty] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} field=${actingFieldIndex} reason=no_acting_pokemon phase=${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"} ui=${UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.())}`,
    );
    return [];
  }

  const actions: DoubleSlotActionSnapshot[] = [];
  const allowSwitchActions = game.isCurrentPhase("SwitchPhase");
  const moveset = actingPokemon.getMoveset().slice(0, 4);
  const moveUsability = moveset.map((move: any) => {
    const [usable, reason] = move.isUsable(actingPokemon, false, true);
    return { move, usable, reason };
  });
  moveUsability.forEach(({ move, usable }, moveIndex: number) => {
    if (!usable) {
      return;
    }
    const moveData = move.getMove();
    const moveTargets = getMoveTargets(actingPokemon, move.moveId);
    // Mirror CommandPhase semantics for the way this harness submits the move:
    // - single-target moves are sent with one resolved target and skip SelectTargetPhase
    // - multi-target moves still enqueue SelectTargetPhase even though their targets are known
    const expectsSelectTargetPhase = moveTargets.multiple && moveTargets.targets.length > 1;
    if (moveTargets.multiple || moveTargets.targets.length <= 1) {
      const selectedTargets = moveTargets.multiple
        ? [...moveTargets.targets]
        : moveTargets.targets.length === 1
          ? [moveTargets.targets[0]!]
          : [];
      const targetPokemon = moveTargets.targets.length === 1
        ? game.scene.getPokemonById(game.scene.getField().find(p => p?.getBattlerIndex?.() === moveTargets.targets[0])?.id)
        : getPrimaryEnemyTarget(game);
      actions.push({
        action_index: actions.length,
        action_kind: "move",
        acting_field_index: actingFieldIndex,
        move_index: moveIndex,
        move_id: move.moveId,
        target_index: moveTargets.multiple ? undefined : moveTargets.targets[0],
        selected_targets: selectedTargets,
        expects_select_target_phase: expectsSelectTargetPhase,
        score: estimateDoubleActionScore(actingPokemon, targetPokemon, moveData),
      });
      return;
    }

    moveTargets.targets
      .filter((targetIndex: BattlerIndex) => isEnemyBattlerIndex(targetIndex))
      .forEach((targetIndex: BattlerIndex) => {
      const targetPokemon = game.scene.getField(true).find(p => p.getBattlerIndex() === targetIndex);
      actions.push({
        action_index: actions.length,
        action_kind: "move",
        acting_field_index: actingFieldIndex,
        move_index: moveIndex,
        move_id: move.moveId,
        target_index: targetIndex,
        selected_targets: [targetIndex],
        expects_select_target_phase: expectsSelectTargetPhase,
        score: estimateDoubleActionScore(actingPokemon, targetPokemon, moveData),
      });
      });
  });

  if (actions.length === 0 && !allowSwitchActions && moveUsability.length > 0 && moveUsability.every(entry => !entry.usable)) {
    const fallbackMoveIndex = moveUsability.findIndex(entry => entry.move != null);
    if (fallbackMoveIndex >= 0) {
      actions.push({
        action_index: 0,
        action_kind: "move",
        acting_field_index: actingFieldIndex,
        move_index: fallbackMoveIndex,
        selected_targets: [],
        expects_select_target_phase: false,
        uses_struggle_fallback: true,
        score: -0.01,
      });
      return actions;
    }
  }

  if (!allowSwitchActions && actions.length > 0) {
    return actions;
  }

  game.scene.getPlayerParty().forEach((member: any, partyIndex: number) => {
    if (!member || member.isFainted() || member.isOnField() || !member.isAllowedInBattle()) {
      return;
    }
    actions.push({
      action_index: actions.length,
      action_kind: "switch",
      acting_field_index: actingFieldIndex,
      switch_party_index: partyIndex,
      score: 0.02 + toHpRatio(member.hp, member.getMaxHp()),
    });
  });

  if (actions.length === 0) {
    const movesetDebug = moveUsability.map(({ move, usable, reason }, moveIndex: number) => {
      const moveTargets = getMoveTargets(actingPokemon, move.moveId);
      return {
        move_index: moveIndex,
        move_name: MoveId[move.moveId] ?? String(move.moveId),
        usable,
        reason: reason ?? null,
        pp_left: Math.max(0, (move.getMovePp?.() ?? 0) - (move.ppUsed ?? 0)),
        targets: moveTargets.targets,
        multiple: moveTargets.multiple,
      };
    });
    console.error(
      `[modifier-fixed-seed-double-actions-empty] ${JSON.stringify({
        wave_index: game.scene.currentBattle?.waveIndex ?? null,
        turn_index: game.scene.currentBattle?.turn ?? null,
        acting_field_index: actingFieldIndex,
        phase_name: game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? null,
        ui_mode: UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.()),
        allow_switch_actions: allowSwitchActions,
        acting_species: SpeciesId[actingPokemon.species?.speciesId] ?? String(actingPokemon.species?.speciesId ?? "unknown"),
        acting_hp_ratio: toHpRatio(actingPokemon.hp, actingPokemon.getMaxHp()),
        player_field: game.scene.getPlayerField(true).map((pokemon: any) => pokemon
          ? {
            battler_index: pokemon.getBattlerIndex?.() ?? null,
            species_name: SpeciesId[pokemon.species?.speciesId] ?? String(pokemon.species?.speciesId ?? "unknown"),
            fainted: pokemon.isFainted?.() ?? false,
            hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
          }
          : null),
        enemy_field: game.scene.getEnemyField(true).map((pokemon: any) => pokemon
          ? {
            battler_index: pokemon.getBattlerIndex?.() ?? null,
            species_name: SpeciesId[pokemon.species?.speciesId] ?? String(pokemon.species?.speciesId ?? "unknown"),
            fainted: pokemon.isFainted?.() ?? false,
            hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
          }
          : null),
        moveset: movesetDebug,
      })}`,
    );
  }

  return actions;
}

function buildDoubleSlotActionMask(actions: DoubleSlotActionSnapshot[]): number[] {
  return actions.map(() => 1);
}

function selectDoubleFallbackAction(actions: DoubleSlotActionSnapshot[]): DoubleSlotActionSnapshot | null {
  if (actions.length === 0) {
    return null;
  }
  const bestAction = [...actions].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.action_kind !== right.action_kind) {
      return left.action_kind === "move" ? -1 : 1;
    }
    return left.action_index - right.action_index;
  })[0];
  return bestAction ?? null;
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

function normalizeModifierTypeId(modifierTypeId?: string | null): string {
  return String(modifierTypeId ?? "").trim().toUpperCase().replaceAll(" ", "_");
}

function isSupportedHpRestoreShopItem(modifierTypeId: string): boolean {
  return new Set(["POTION", "SUPER_POTION", "HYPER_POTION", "MAX_POTION", "FULL_RESTORE"]).has(
    normalizeModifierTypeId(modifierTypeId),
  );
}

function isSupportedStatusHealShopItem(modifierTypeId: string): boolean {
  return normalizeModifierTypeId(modifierTypeId) === "FULL_HEAL";
}

function isSupportedReviveShopItem(modifierTypeId: string): boolean {
  return new Set(["REVIVE", "MAX_REVIVE"]).has(normalizeModifierTypeId(modifierTypeId));
}

function isSupportedDirectShopItem(modifierTypeId: string): boolean {
  return normalizeModifierTypeId(modifierTypeId) === "SACRED_ASH";
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
  hasStatusProblem: boolean;
} {
  const party = game.scene.getPlayerParty();
  return {
    hasMissingHp: party.some(pokemon => !pokemon.isFainted() && pokemon.hp < pokemon.getMaxHp()),
    hasFaintedPokemon: party.some(pokemon => pokemon.isFainted()),
    hasMissingPp: party.some(pokemon => pokemon.getMoveset().some((move: any) => move.ppUsed > 0)),
    hasStatusProblem: party.some(pokemon => !pokemon.isFainted() && pokemon.status?.effect != null),
  };
}

function getActionAvailability(game: GameManager, option: any): { available: boolean; reason?: string } {
  const modifierTypeId = getModifierTypeId(option);
  const normalizedModifierTypeId = normalizeModifierTypeId(modifierTypeId);
  const partyFlags = getPartyResourceFlags(game);
  const cost = option.modifierTypeOption?.cost ?? 0;

  if (cost > game.scene.money) {
    return { available: false, reason: "insufficient_money" };
  }
  if (isSupportedHpRestoreShopItem(modifierTypeId) && !partyFlags.hasMissingHp) {
    return { available: false, reason: "no_injured_pokemon" };
  }
  if (isSupportedStatusHealShopItem(modifierTypeId) && !partyFlags.hasStatusProblem) {
    return { available: false, reason: "no_status_problem" };
  }
  if ((isSupportedReviveShopItem(modifierTypeId) || normalizedModifierTypeId === "SACRED_ASH") && !partyFlags.hasFaintedPokemon) {
    return { available: false, reason: "no_fainted_pokemon" };
  }
  if (normalizedModifierTypeId.includes("ETHER") && !partyFlags.hasMissingPp) {
    return { available: false, reason: "no_missing_pp" };
  }
  return { available: true };
}

function getActionExecutability(
  actionType: "take_reward" | "buy_shop_item",
  option: any,
): { executable: boolean; reason?: string; requiresPartyTarget?: boolean } {
  const modifierTypeId = getModifierTypeId(option);
  const normalizedModifierTypeId = normalizeModifierTypeId(modifierTypeId);
  const modifierType = option?.modifierTypeOption?.type;
  const modifierTypeName = String(modifierType?.constructor?.name ?? "");
  if (actionType === "take_reward") {
    if (normalizedModifierTypeId === "MEMORY_MUSHROOM" || modifierTypeName === "RememberMoveModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:remember_move_todo" };
    }
    if (normalizedModifierTypeId === "TERA_SHARD" || modifierTypeName === "TerastallizeModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:tera_shard_todo" };
    }
    if (normalizedModifierTypeId === "DNA_SPLICERS" || modifierTypeName === "FusePokemonModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:fuse_todo" };
    }
    if (
      modifierTypeName === "FormChangeItemModifierType"
      && BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS.has(String(normalizedModifierTypeId))
    ) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:form_change_group2_todo" };
    }
    if (normalizedModifierTypeId.startsWith("TM")) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:tm_selection_todo" };
    }
    if (
      OFFLINE_BLOCKED_REWARD_IDS.has(normalizedModifierTypeId)
      || OFFLINE_BLOCKED_MODIFIER_TYPE_NAMES.has(modifierTypeName)
    ) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy" };
    }
    if (typeof modifierType?.moveSelectFilter === "function") {
      return { executable: false, reason: "requires_move_selection" };
    }
    if (typeof modifierType?.selectFilter === "function") {
      return { executable: true, requiresPartyTarget: true };
    }
    if (OFFLINE_ALLOWED_DIRECT_REWARD_IDS.has(normalizedModifierTypeId)) {
      return { executable: true };
    }
    return { executable: false, reason: "requires_followup_selection" };
  }

  if (
    (isSupportedHpRestoreShopItem(modifierTypeId)
      || isSupportedStatusHealShopItem(modifierTypeId)
      || isSupportedReviveShopItem(modifierTypeId))
    && typeof modifierType?.selectFilter === "function"
  ) {
    return { executable: true, requiresPartyTarget: true };
  }
  if (isSupportedDirectShopItem(modifierTypeId)) {
    return { executable: true };
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
      if (executability.requiresPartyTarget) {
        game.scene.getPlayerParty().forEach((_pokemon: any, partyIndex: number) => {
          const targetAvailability = getRewardTargetAvailability(game, option, partyIndex);
          const available = availability.available && targetAvailability.available && executability.executable;
          actions.push({
            action_index: actions.length,
            action_type: "buy_shop_item",
            shop_row_index: rowIndex,
            shop_column_index: columnIndex,
            target_party_index: partyIndex,
            modifier_type_id: getModifierTypeId(option),
            cost: option.modifierTypeOption?.cost ?? 0,
            available,
            executable: executability.executable,
            unavailable_reason: availability.reason ?? targetAvailability.reason,
            non_executable_reason: executability.reason,
          });
          actionMask.push(available ? 1 : 0);
        });
      } else {
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
      }
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
  const commandFieldIndex = game.isCurrentPhase("CommandPhase") ? getCommandFieldIndexSafe(game) : null;
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
    command_field_index: commandFieldIndex,
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

function normalizeCommandPhaseUiIfNeeded(game: GameManager): boolean {
  if (!game.isCurrentPhase("CommandPhase")) {
    return false;
  }
  if (game.scene.ui?.getMode?.() !== UiMode.PARTY) {
    return false;
  }
  game.scene.ui.setMode(UiMode.COMMAND, getCommandFieldIndexSafe(game));
  return true;
}

function getRecoverableDoublePartnerCommandFieldIndex(game: GameManager): number | null {
  if (!game.scene.currentBattle?.double || !game.isCurrentPhase("CommandPhase")) {
    return null;
  }
  if (game.scene.ui?.getMode?.() !== UiMode.MESSAGE) {
    return null;
  }

  const fieldIndex = getCommandFieldIndexSafe(game);
  if (!Number.isInteger(fieldIndex) || fieldIndex <= 0) {
    return null;
  }

  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as { getPokemon?: () => any } | undefined;
  const phasePokemon = typeof currentPhase?.getPokemon === "function" ? currentPhase.getPokemon() : null;
  if (!phasePokemon || phasePokemon.isFainted?.()) {
    return null;
  }

  const activePlayerField = game.scene.getPlayerField(true).filter((pokemon: any) => pokemon?.isActive?.());
  if (activePlayerField.length <= fieldIndex) {
    return null;
  }

  const turnCommands = (game.scene.currentBattle as any)?.turnCommands;
  if (Array.isArray(turnCommands) && turnCommands[fieldIndex]?.skip) {
    return null;
  }

  return fieldIndex;
}

function getCurrentCommandPhaseFieldIndex(game: GameManager): number | null {
  if (!game.isCurrentPhase("CommandPhase")) {
    return null;
  }
  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as { getFieldIndex?: () => number } | undefined;
  if (typeof currentPhase?.getFieldIndex !== "function") {
    return null;
  }
  const fieldIndex = currentPhase.getFieldIndex();
  return Number.isInteger(fieldIndex) ? fieldIndex : null;
}

async function waitForCommandPhaseAfterModifierAction(
  game: GameManager,
  timeoutMs: number,
): Promise<void> {
  clearStaleCombatCommandPrompts(game);
  let commandReached = false;
  let commandFailed = false;

  game.phaseInterceptor.to("CommandPhase")
    .then(() => {
      commandReached = true;
    })
    .catch(() => {
      commandFailed = true;
    });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (game.isCurrentPhase("CommandPhase")) {
      return;
    }
    if (commandReached) {
      return;
    }
    if (commandFailed) {
      throw new Error("Failed while waiting for CommandPhase after modifier action");
    }

    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    if (normalizeCommandPhaseUiIfNeeded(game)) {
      await sleep(25);
      continue;
    }

    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }

    await sleep(25);
  }

  if (commandReached) {
    return;
  }

  throw new Error(`step_timeout:modifier_action_to_command_phase:${timeoutMs}`);
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

  console.error(`[modifier-fixed-seed-single-dqn] request valid=${valid.join(",")}`);
  const action = await inferCombatActionWithDqn(state, actionMask);
  console.error(`[modifier-fixed-seed-single-dqn] response action=${action}`);
  if (valid.includes(action)) {
    return { action, actionSource: "dqn" };
  }

  return { action: valid[0] ?? sampleUniformAction(valid), actionSource: "dqn_invalid_fallback_first_valid" };
}

function selectSingleBattleLoopGuardAction(combatTurns: CombatDecisionSnapshot[], actionMask: number[]): { action: number; actionSource: string } | null {
  const recentTurns = combatTurns.slice(-4);
  if (recentTurns.length < 4) {
    return null;
  }

  const allRecentActionsAreSwitches = recentTurns.every(turn => !turn.is_double_battle && turn.selected_action >= MOVE_ACTIONS);
  if (!allRecentActionsAreSwitches) {
    return null;
  }

  const validMoveAction = actionMask.slice(0, MOVE_ACTIONS).findIndex(value => value === 1);
  if (validMoveAction < 0) {
    return null;
  }

  return {
    action: validMoveAction,
    actionSource: "single_battle_switch_loop_guard_first_valid_move",
  };
}

function selectSingleBattleStruggleFallbackAction(
  game: GameManager,
  actionMask: number[],
): { action: number; actionSource: string } | null {
  if (actionMask.some(value => value === 1)) {
    return null;
  }

  const player = game.scene.getPlayerPokemon?.();
  if (!player) {
    return null;
  }

  const moveSlots = (player.getMoveset?.() ?? []).slice(0, MOVE_ACTIONS);
  if (moveSlots.length === 0) {
    return null;
  }

  const firstMoveIndex = moveSlots.findIndex((move: any) => move != null);
  if (firstMoveIndex < 0) {
    return null;
  }

  const allMovesUnusable = moveSlots.every((move: any) => {
    if (!move) {
      return true;
    }
    const [usable] = move.isUsable(player, false, true);
    return !usable;
  });
  if (!allMovesUnusable) {
    return null;
  }

  console.error(
    `[modifier-fixed-seed-single-struggle-fallback] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} move_index=${firstMoveIndex}`,
  );
  return {
    action: firstMoveIndex,
    actionSource: "single_struggle_fallback",
  };
}

function normalizeCombatActionMaskForSnapshot(
  actionMask: number[],
  selectedAction: number,
  actionSource: string,
): number[] {
  const normalizedMask = [...actionMask];
  if (actionSource !== "single_struggle_fallback") {
    return normalizedMask;
  }
  if (selectedAction < 0) {
    return normalizedMask;
  }
  while (normalizedMask.length <= selectedAction) {
    normalizedMask.push(0);
  }
  normalizedMask[selectedAction] = 1;
  return normalizedMask;
}

function queueMoveByIndex(game: GameManager, actionIndex: number): void {
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
}

function queueMoveByIndexWithResolvedTargets(
  game: GameManager,
  actionIndex: number,
  moveId: MoveId,
  targets: BattlerIndex[],
): void {
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
      {
        move: moveId,
        targets,
        useMode: MoveUseMode.NORMAL,
      },
    );
  });
}

function selectMoveByIndex(game: GameManager, actionIndex: number, targetIndex?: BattlerIndex): void {
  queueMoveByIndex(game, actionIndex);
  game.selectTarget(actionIndex, targetIndex);
}

function queueDoubleTargetSelection(game: GameManager, action: DoubleSlotActionSnapshot): void {
  game.onNextPrompt(
    "SelectTargetPhase",
    UiMode.TARGET_SELECT,
    () => {
      console.error(
        `[modifier-fixed-seed-double-target-callback] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${action.acting_field_index} target=${action.target_index ?? "na"} move_index=${action.move_index ?? "na"}`,
      );
      resolveCurrentTargetSelection(game, action);
    },
    () => isCombatTerminalPhase(game),
  );
}

function resolveCurrentTargetSelection(game: GameManager, action: DoubleSlotActionSnapshot): void {
  if (!game.isCurrentPhase("SelectTargetPhase")) {
    throw new Error(`resolveCurrentTargetSelection called outside SelectTargetPhase:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`);
  }

  const handler = game.scene.ui.getHandler() as {
    setCursor?: (cursor: number) => boolean;
    processInput?: (button: Button) => boolean;
  } | undefined;
  if (typeof handler?.processInput !== "function") {
    throw new Error("Target selection handler is not ready");
  }

  const currentPhase = game.scene.phaseManager?.getCurrentPhase?.() as { getPokemon?: () => any } | undefined;
  const actingPokemon = typeof currentPhase?.getPokemon === "function" ? currentPhase.getPokemon() : null;
  const selectedMove = action.move_index != null
    ? actingPokemon?.getMoveset?.()?.[action.move_index]?.getMove?.()
    : null;

  if (selectedMove && !selectedMove.isMultiTarget() && action.target_index != null && typeof handler.setCursor === "function") {
    handler.setCursor(action.target_index);
  }

  console.error(
    `[modifier-fixed-seed-double-target-resolve] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${action.acting_field_index} target=${action.target_index ?? "na"} ui=${UiMode[game.scene.ui.getMode() as number] ?? String(game.scene.ui.getMode())}`,
  );
  handler.processInput(Button.ACTION);
}

function selectSwitchByPartyIndex(game: GameManager, partyIndex: number): void {
  game.doSwitchPokemon(partyIndex);
}

function executeCombatAction(game: GameManager, action: number): void {
  if (action < MOVE_ACTIONS) {
    selectMoveByIndex(game, action, BattlerIndex.ENEMY);
    return;
  }

  selectSwitchByPartyIndex(game, action - MOVE_ACTIONS);
}

function executeDoubleSlotAction(game: GameManager, action: DoubleSlotActionSnapshot): void {
  if (action.action_kind === "switch") {
    if (action.switch_party_index == null) {
      throw new Error("Double slot switch action missing switch_party_index");
    }
    selectSwitchByPartyIndex(game, action.switch_party_index);
    return;
  }
  if (action.move_index == null) {
    throw new Error("Double slot move action missing move_index");
  }
  const selectedTargets = Array.isArray(action.selected_targets) ? action.selected_targets.filter(target => target != null) : [];
  if (action.move_id != null && selectedTargets.length === 1) {
    queueMoveByIndexWithResolvedTargets(game, action.move_index, action.move_id as MoveId, selectedTargets);
    return;
  }
  if (action.expects_select_target_phase) {
    queueMoveByIndex(game, action.move_index);
    queueDoubleTargetSelection(game, action);
    return;
  }
  if (action.move_id != null && selectedTargets.length >= 1) {
    queueMoveByIndexWithResolvedTargets(game, action.move_index, action.move_id as MoveId, selectedTargets);
    return;
  }

  queueMoveByIndex(game, action.move_index);
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

function isGameTerminalPhase(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase")
    || game.isCurrentPhase("PostGameOverPhase")
    || game.isCurrentPhase("TitlePhase");
}

function isContinuousEncounterContinuationPhase(game: GameManager): boolean {
  if (isGameTerminalPhase(game) || game.isCurrentPhase("SelectModifierPhase")) {
    return false;
  }

  return game.isCurrentPhase("CommandPhase")
    || game.isCurrentPhase("NewBattlePhase")
    || game.isCurrentPhase("NextEncounterPhase")
    || game.isCurrentPhase("NewBiomeEncounterPhase")
    || game.isCurrentPhase("EncounterPhase")
    || game.isCurrentPhase("ReturnPhase")
    || game.isCurrentPhase("SummonPhase")
    || game.isCurrentPhase("ToggleDoublePositionPhase")
    || game.isCurrentPhase("CheckSwitchPhase")
    || game.isCurrentPhase("InitEncounterPhase")
    || game.isCurrentPhase("PostSummonPhase")
    || game.isCurrentPhase("TurnInitPhase");
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

function clearStaleCombatCommandPrompts(game: GameManager): void {
  const interceptor = game.phaseInterceptor as any;
  if (!Array.isArray(interceptor?.prompts) || interceptor.prompts.length === 0) {
    return;
  }
  interceptor.prompts = interceptor.prompts.filter((prompt: { phaseTarget?: string; mode?: UiMode }) => {
    if (prompt?.phaseTarget !== "CommandPhase") {
      return true;
    }
    return prompt.mode !== UiMode.COMMAND && prompt.mode !== UiMode.FIGHT;
  });
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
  isSuccessfulState?: (game: GameManager) => boolean,
  terminalPhaseLogStartIndex?: number,
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
    const loggedTerminal = terminalPhaseLogStartIndex != null
      && hasLoggedTerminalPhaseSince(game, terminalPhaseLogStartIndex);
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    if (normalizeCommandPhaseUiIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (isCombatTerminalPhase(game) || loggedTerminal) {
      return "terminal";
    }
    if (isSuccessfulState?.(game) === true) {
      return "ok";
    }
    if (resolved) {
      return "ok";
    }
    if (failed) {
      return isCombatTerminalPhase(game) || loggedTerminal ? "terminal" : "timeout";
    }
    await sleep(25);
  }

  return isCombatTerminalPhase(game)
    || (
      terminalPhaseLogStartIndex != null
      && hasLoggedTerminalPhaseSince(game, terminalPhaseLogStartIndex)
    )
    ? "terminal"
    : "timeout";
}

async function waitForCommandOrTerminalAfterForcedSwitch(game: GameManager, timeoutMs: number): Promise<"ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    if (normalizeCommandPhaseUiIfNeeded(game)) {
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
  const startingTurn = game.scene.currentBattle?.turn ?? 0;
  const endOfTurnPhaseLogStart = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log.length : 0;
  const endOfTurnStatus = await waitForPromiseOrTerminal(
    game,
    withTimeout(game.toEndOfTurn(), STEP_TIMEOUT_MS, "end of turn"),
    STEP_TIMEOUT_MS,
    currentGame => {
      const currentTurn = currentGame.scene.currentBattle?.turn ?? startingTurn;
      return currentTurn > startingTurn
        && currentGame.isCurrentPhase("CommandPhase")
        && currentGame.scene.ui?.getMode?.() === UiMode.COMMAND;
    },
    endOfTurnPhaseLogStart,
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
    if (normalizeCommandPhaseUiIfNeeded(game)) {
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
    if (game.isCurrentPhase("CommandPhase") && game.scene.ui?.getMode?.() === UiMode.COMMAND) {
      return "ok";
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

async function waitForDoubleTargetPhaseOrImmediateFollowup(
  game: GameManager,
  action: DoubleSlotActionSnapshot,
  startingTurn: number,
  timeoutMs: number,
): Promise<"select_target" | "ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    if (normalizeCommandPhaseUiIfNeeded(game)) {
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
    if (game.isCurrentPhase("SelectTargetPhase")) {
      return "select_target";
    }
    if (game.isCurrentPhase("CommandPhase") && game.scene.ui?.getMode?.() === UiMode.COMMAND) {
      const fieldIndex = getCommandFieldIndexSafe(game);
      const currentTurn = game.scene.currentBattle?.turn ?? startingTurn;
      if (fieldIndex > action.acting_field_index || currentTurn > startingTurn) {
        console.error(
          `[modifier-fixed-seed-double-target-shortcut] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${action.acting_field_index} next_field=${fieldIndex} turn=${currentTurn}`,
        );
        return "ok";
      }
    }
    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    await sleep(25);
  }

  return isCombatTerminalPhase(game) ? "terminal" : "timeout";
}

async function advanceDoubleCombatAfterAction(
  game: GameManager,
  action: DoubleSlotActionSnapshot,
): Promise<"ok" | "terminal" | "timeout"> {
  const startingTurn = game.scene.currentBattle?.turn ?? 0;
  const needsTargetSelection = action.action_kind === "move" && action.expects_select_target_phase === true;

  if (needsTargetSelection) {
    const targetStatus = await waitForDoubleTargetPhaseOrImmediateFollowup(
      game,
      action,
      startingTurn,
      STEP_TIMEOUT_MS,
    );
    if (targetStatus === "ok") {
      return "ok";
    }
    if (targetStatus !== "select_target") {
      return targetStatus;
    }
    const targetResolutionStatus = await waitForDoubleTargetSelectionResolution(game, STEP_TIMEOUT_MS);
    if (targetResolutionStatus !== "ok") {
      return targetResolutionStatus;
    }
    if (action.acting_field_index === 0 && game.isCurrentPhase("CommandPhase") && game.scene.ui.getMode() === UiMode.COMMAND) {
      const fieldIndex = getCommandFieldIndexSafe(game);
      const currentTurn = game.scene.currentBattle?.turn ?? startingTurn;
      if (fieldIndex > 0 || currentTurn > startingTurn) {
        return "ok";
      }
    }
  }

  if (isCombatTerminalPhase(game)) {
    return "terminal";
  }

  if (action.acting_field_index === 0) {
    const fieldZeroFollowupStatus = await waitForDoubleFieldZeroFollowup(game, startingTurn, STEP_TIMEOUT_MS);
    if (fieldZeroFollowupStatus === "terminal" || fieldZeroFollowupStatus === "timeout") {
      return fieldZeroFollowupStatus;
    }
    if (fieldZeroFollowupStatus === "partner_command") {
      return isCombatTerminalPhase(game) ? "terminal" : "ok";
    }
    const currentTurn = game.scene.currentBattle?.turn ?? startingTurn;
    const alreadyAdvancedToNextCommandTurn = currentTurn > startingTurn
      && game.isCurrentPhase("CommandPhase")
      && game.scene.ui?.getMode?.() === UiMode.COMMAND;
    if (alreadyAdvancedToNextCommandTurn) {
      return "ok";
    }
    const nextTurnStatus = await waitForPromiseOrTerminal(
      game,
      withTimeout(game.toNextTurn(), STEP_TIMEOUT_MS, "double_field0_to_next_turn"),
      STEP_TIMEOUT_MS,
      currentGame => {
        const nextTurn = currentGame.scene.currentBattle?.turn ?? startingTurn;
        return nextTurn > startingTurn
          && currentGame.isCurrentPhase("CommandPhase")
          && currentGame.scene.ui?.getMode?.() === UiMode.COMMAND;
      },
    );
    if (nextTurnStatus !== "ok") {
      return nextTurnStatus;
    }
    return "ok";
  }

  const nextTurnStatus = await waitForPromiseOrTerminal(
    game,
    withTimeout(game.toNextTurn(), STEP_TIMEOUT_MS, "double_to_next_turn"),
    STEP_TIMEOUT_MS,
    currentGame => {
      const currentTurn = currentGame.scene.currentBattle?.turn ?? startingTurn;
      return currentTurn > startingTurn
        && currentGame.isCurrentPhase("CommandPhase")
        && currentGame.scene.ui?.getMode?.() === UiMode.COMMAND;
    },
  );
  if (nextTurnStatus !== "ok") {
    return nextTurnStatus;
  }
  return "ok";
}

async function waitForDoubleTargetSelectionResolution(
  game: GameManager,
  timeoutMs: number,
): Promise<"ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (isCombatTerminalPhase(game)) {
      return "terminal";
    }
    if (game.isCurrentPhase("SelectTargetPhase") && advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    if (!game.isCurrentPhase("SelectTargetPhase") && game.scene.ui.getMode() !== UiMode.TARGET_SELECT) {
      return "ok";
    }
    await sleep(25);
  }
  return isCombatTerminalPhase(game) ? "terminal" : "timeout";
}

async function waitForDoubleFieldZeroFollowup(
  game: GameManager,
  startingTurn: number,
  timeoutMs: number,
): Promise<"partner_command" | "turn_progressed" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  let stuckCommandMessageSince: number | null = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    if (normalizeCommandPhaseUiIfNeeded(game)) {
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

    if (game.isCurrentPhase("CommandPhase") && game.scene.ui.getMode() === UiMode.COMMAND) {
      const fieldIndex = getCommandFieldIndexSafe(game);
      if (fieldIndex > 0) {
        return "partner_command";
      }
      const currentTurn = game.scene.currentBattle?.turn ?? startingTurn;
      if (currentTurn > startingTurn) {
        return "turn_progressed";
      }
    }

    if (game.isCurrentPhase("CommandPhase") && game.scene.ui.getMode() === UiMode.MESSAGE) {
      if (stuckCommandMessageSince == null) {
        stuckCommandMessageSince = Date.now();
      } else if (Date.now() - stuckCommandMessageSince >= 250) {
        const recoverableDoublePartnerFieldIndex = getRecoverableDoublePartnerCommandFieldIndex(game);
        if (recoverableDoublePartnerFieldIndex != null) {
          const currentCommandPhaseFieldIndex = getCurrentCommandPhaseFieldIndex(game);
          console.error(
            `[modifier-fixed-seed-double-followup-recover-command] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${recoverableDoublePartnerFieldIndex} phaseField=${currentCommandPhaseFieldIndex ?? "unknown"}`,
          );
          const recoverStatus = await waitForPromiseOrTerminal(
            game,
            withTimeout(
              game.phaseInterceptor.to("CommandPhase"),
              STEP_TIMEOUT_MS,
              "double_followup_command_phase_recover",
            ),
            STEP_TIMEOUT_MS,
          );
          if (recoverStatus !== "ok") {
            return recoverStatus;
          }
          await sleep(25);
          continue;
        }
      }
    } else {
      stuckCommandMessageSince = null;
    }

    if (
      game.isCurrentPhase("EnemyCommandPhase")
      || game.isCurrentPhase("TurnStartPhase")
      || game.isCurrentPhase("MovePhase")
      || game.isCurrentPhase("TurnEndPhase")
      || game.isCurrentPhase("TurnInitPhase")
    ) {
      return "turn_progressed";
    }

    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    await sleep(25);
  }

  return isCombatTerminalPhase(game) ? "terminal" : "timeout";
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

async function waitForSelectModifierPhaseReady(game: GameManager, timeoutMs: number): Promise<void> {
  let phaseReached = false;
  let phaseFailed = false;

  game.phaseInterceptor.to("SelectModifierPhase")
    .then(() => {
      phaseReached = true;
    })
    .catch(() => {
      phaseFailed = true;
    });

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (game.isCurrentPhase("SelectModifierPhase") && game.scene.ui.getMode() === UiMode.MODIFIER_SELECT) {
      return;
    }
    if (phaseReached) {
      return;
    }
    if (phaseFailed) {
      throw new Error("Failed while waiting for SelectModifierPhase");
    }
    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    await sleep(25);
  }

  throw new Error(`step_timeout:select_modifier_phase_ready:${timeoutMs}`);
}

async function waitForCombatCommandInputReady(game: GameManager, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  let stuckCommandMessageSince: number | null = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (resolveLearnMoveIfNeeded(game)) {
      await sleep(25);
      continue;
    }
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      throw new Error("no_candidate_forced_switch");
    }
    if (isCombatTerminalPhase(game)) {
      return;
    }
    if (game.isCurrentPhase("CommandPhase") && game.scene.ui.getMode() === UiMode.COMMAND) {
      return;
    }
    if (game.isCurrentPhase("CommandPhase") && game.scene.ui.getMode() === UiMode.MESSAGE) {
      if (stuckCommandMessageSince == null) {
        stuckCommandMessageSince = Date.now();
      } else if (Date.now() - stuckCommandMessageSince >= 250) {
        const recoverableDoublePartnerFieldIndex = getRecoverableDoublePartnerCommandFieldIndex(game);
        if (recoverableDoublePartnerFieldIndex != null) {
          const currentCommandPhaseFieldIndex = getCurrentCommandPhaseFieldIndex(game);
          console.error(
            `[modifier-fixed-seed-double-recover-command] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${recoverableDoublePartnerFieldIndex} phaseField=${currentCommandPhaseFieldIndex ?? "unknown"}`,
          );
          const recoverStatus = await waitForPromiseOrTerminal(
            game,
            withTimeout(
              game.phaseInterceptor.to("CommandPhase"),
              STEP_TIMEOUT_MS,
              "double_command_phase_recover",
            ),
            STEP_TIMEOUT_MS,
          );
          if (recoverStatus === "timeout") {
            throw new Error(`step_timeout:double_command_phase_recover:${STEP_TIMEOUT_MS}`);
          }
          if (recoverStatus === "terminal") {
            return;
          }
          await sleep(25);
          continue;
        }
        if (game.scene.currentBattle?.double !== true) {
          const fieldIndex = getCommandFieldIndexSafe(game);
          console.error(
            `[modifier-fixed-seed-single-force-command] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} field=${fieldIndex}`,
          );
          game.scene.ui.showText("", 0);
          game.scene.ui.setMode(UiMode.COMMAND, fieldIndex);
          await sleep(25);
          continue;
        }
      }
    } else {
      stuckCommandMessageSince = null;
    }
    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    await sleep(25);
  }

  throw new Error(`step_timeout:combat_command_input_ready:${timeoutMs}`);
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
  await waitForCommandPhaseAfterModifierAction(game, STEP_TIMEOUT_MS);
}

function toRewardRowCursor(): number {
  return ShopCursorTarget.REWARDS;
}

function toShopRowCursor(shopRowIndex: number): number {
  return shopRowIndex + 2;
}

async function selectModifierOptionAndResolvePartyTarget(
  game: GameManager,
  rowCursor: number,
  cursor: number,
  targetPartyIndex?: number,
): Promise<UiMode> {
  await waitForModifierInputReady(game);
  const handler = getModifierHandler(game);
  handler.setRowCursor(rowCursor);
  handler.setCursor(cursor);
  handler.processInput(Button.ACTION);

  const followupMode = await waitForModifierRewardFollowupMode(game);
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

  return followupMode;
}

async function waitForModifierSelectOrCommandPhaseAfterShopAction(
  game: GameManager,
  timeoutMs: number,
): Promise<"modifier_select" | "command_phase"> {
  clearStaleCombatCommandPrompts(game);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (game.isCurrentPhase("CommandPhase")) {
      return "command_phase";
    }
    if (game.isCurrentPhase("SelectModifierPhase") && game.scene.ui.getMode() === UiMode.MODIFIER_SELECT) {
      return "modifier_select";
    }
    if (advanceCurrentUiPromptIfPossible(game)) {
      await sleep(25);
      continue;
    }
    await sleep(25);
  }

  throw new Error(`step_timeout:shop_action_followup:${timeoutMs}`);
}

async function executeTakeRewardAction(game: GameManager, rewardIndex: number, targetPartyIndex?: number): Promise<"command_phase"> {
  const followupMode = await selectModifierOptionAndResolvePartyTarget(
    game,
    toRewardRowCursor(),
    rewardIndex,
    targetPartyIndex,
  );
  console.error(
    `[modifier-fixed-seed-reward] after_select wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} ui=${UiMode[followupMode] ?? followupMode} reward_index=${rewardIndex}`,
  );

  await waitForCommandPhaseAfterModifierAction(game, STEP_TIMEOUT_MS);
  return "command_phase";
}

async function executeBuyShopItemAction(
  game: GameManager,
  shopRowIndex: number,
  shopColumnIndex: number,
  targetPartyIndex?: number,
): Promise<"modifier_select" | "command_phase"> {
  const followupMode = await selectModifierOptionAndResolvePartyTarget(
    game,
    toShopRowCursor(shopRowIndex),
    shopColumnIndex,
    targetPartyIndex,
  );
  console.error(
    `[modifier-fixed-seed-shop-buy] after_select wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} ui=${UiMode[followupMode] ?? followupMode} shop_row=${shopRowIndex} shop_col=${shopColumnIndex}`,
  );
  return waitForModifierSelectOrCommandPhaseAfterShopAction(game, STEP_TIMEOUT_MS);
}

async function executeModifierAction(game: GameManager, action: ModifierActionSnapshot): Promise<"modifier_select" | "command_phase"> {
  switch (action.action_type) {
    case "skip":
      await executeSkipAction(game);
      return "command_phase";
    case "take_reward":
      if (action.reward_index == null) {
        throw new Error("Reward action missing reward_index");
      }
      return executeTakeRewardAction(game, action.reward_index, action.target_party_index);
    case "buy_shop_item":
      if (action.shop_row_index == null || action.shop_column_index == null) {
        throw new Error("Shop action missing shop coordinates");
      }
      return executeBuyShopItemAction(
        game,
        action.shop_row_index,
        action.shop_column_index,
        action.target_party_index,
      );
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

  if (isSupportedHpRestoreShopItem(selectedAction.modifier_type_id) && partyFlags.hasMissingHp) {
    reward += 1.0;
  }
  if (
    (isSupportedReviveShopItem(selectedAction.modifier_type_id) || isSupportedDirectShopItem(selectedAction.modifier_type_id))
    && partyFlags.hasFaintedPokemon
  ) {
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

function buildFakeModifierOption(
  modifierTypeId: string,
  extraType: Record<string, unknown> = {},
  modifierTypeName = "ModifierType",
): any {
  return {
    modifierTypeOption: {
      cost: 0,
      upgradeCount: 0,
      type: {
        id: modifierTypeId,
        name: modifierTypeId,
        constructor: {
          name: modifierTypeName,
        },
        ...extraType,
      },
    },
  };
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
    cleanupPersistentExternalPolicyWorkers();
  });

  it("applies offline reward executability policy to blocked, direct, and target rewards", () => {
    expect(getActionExecutability("take_reward", buildFakeModifierOption("MAP"))).toEqual({
      executable: false,
      reason: "blocked_by_offline_modifier_policy",
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("VOUCHER"))).toEqual({
      executable: false,
      reason: "blocked_by_offline_modifier_policy",
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("LURE"))).toEqual({
      executable: true,
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("ROGUE_BALL"))).toEqual({
      executable: true,
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("RARER_CANDY"))).toEqual({
      executable: true,
    });

    expect(
      getActionExecutability(
        "take_reward",
        buildFakeModifierOption(
          "LEFTOVERS",
          {
            selectFilter: () => null,
          },
          "PokemonHeldItemModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
      requiresPartyTarget: true,
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("TM_FLAMETHROWER"))).toEqual({
      executable: false,
      reason: "blocked_by_offline_modifier_policy:tm_selection_todo",
    });

    expect(
      getActionExecutability(
        "take_reward",
        buildFakeModifierOption("MEMORY_MUSHROOM", {}, "RememberMoveModifierType"),
      ),
    ).toEqual({
      executable: false,
      reason: "blocked_by_offline_modifier_policy:remember_move_todo",
    });

    expect(getActionExecutability("take_reward", buildFakeModifierOption("UNKNOWN_REWARD"))).toEqual({
      executable: false,
      reason: "requires_followup_selection",
    });

    expect(
      getActionExecutability(
        "buy_shop_item",
        buildFakeModifierOption(
          "Potion",
          {
            selectFilter: () => null,
          },
          "PokemonHpRestoreModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
      requiresPartyTarget: true,
    });

    expect(
      getActionExecutability(
        "buy_shop_item",
        buildFakeModifierOption(
          "Full Heal",
          {
            selectFilter: () => null,
          },
          "PokemonStatusHealModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
      requiresPartyTarget: true,
    });

    expect(
      getActionExecutability(
        "buy_shop_item",
        buildFakeModifierOption(
          "Revive",
          {
            selectFilter: () => null,
          },
          "PokemonReviveModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
      requiresPartyTarget: true,
    });

    expect(
      getActionExecutability(
        "buy_shop_item",
        buildFakeModifierOption(
          "Max Revive",
          {
            selectFilter: () => null,
          },
          "PokemonReviveModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
      requiresPartyTarget: true,
    });

    expect(
      getActionExecutability(
        "buy_shop_item",
        buildFakeModifierOption(
          "Sacred Ash",
          {},
          "AllPokemonFullReviveModifierType",
        ),
      ),
    ).toEqual({
      executable: true,
    });
  });

  it("collects repeated fixed-seed modifier runs", async () => {
    const episodes: EpisodeRecord[] = [];

    for (let localRunIndex = 0; localRunIndex < RUN_COUNT; localRunIndex += 1) {
      const runIndex = RUN_INDEX_OFFSET + localRunIndex;
      let recordedEpisode: EpisodeRecord | null = null;

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        const game = new GameManager(phaserGame);

        game.override.seed(SEED);

        if (COLLECTOR_VARIANT === "sanity_masking") {
          game.override
            .disableTrainerWaves()
            .enemySpecies(SpeciesId.MAGIKARP)
            .enemyMoveset(MoveId.SPLASH);
        }

        if (COLLECTOR_VARIANT === "strategic_fixed_seed") {
          // Keep real seeded encounters for strategic data generation.
        }

        const random = createDeterministicRandom(`${SEED}::${runIndex}`);
        const decisionRngSeed = `${SEED}::${runIndex}`;
        const steps: ModifierStepRecord[] = [];
        let completedWaves = 0;
        let terminationReason = "unknown";
        let timeoutDebug: TimeoutDebugSnapshot | undefined;
        let errorDebug: TimeoutDebugSnapshot | undefined;
        let errorStack: string | undefined;
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
                const battleWaveIndexBeforeAction = game.scene.currentBattle?.waveIndex ?? 0;
                await waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS);
                const doubleState = buildDoubleCombatObservation(game);
                const doubleActions = buildDoubleSlotActions(game);
                const doubleActionMask = buildDoubleSlotActionMask(doubleActions);
                const selectedDoubleAction = selectDoubleFallbackAction(doubleActions);
                if (!selectedDoubleAction) {
                  terminationReason = "no_valid_double_action";
                  break;
                }
                console.error(
                  `[modifier-fixed-seed-double-action] wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} field=${selectedDoubleAction.acting_field_index} kind=${selectedDoubleAction.action_kind} move_index=${selectedDoubleAction.move_index ?? "na"} target=${selectedDoubleAction.target_index ?? "na"} switch_party_index=${selectedDoubleAction.switch_party_index ?? "na"} struggle=${selectedDoubleAction.uses_struggle_fallback ? 1 : 0}`,
                );

                combatTurns.push(
                  buildDoubleCombatDecisionSnapshot(
                    game,
                    doubleState,
                    selectedDoubleAction,
                    doubleActionMask,
                    "double_fallback",
                  ),
                );
                executeDoubleSlotAction(game, selectedDoubleAction);

                const advanceStatus = await withTimeout(
                  advanceDoubleCombatAfterAction(game, selectedDoubleAction),
                  STEP_TIMEOUT_MS,
                  "advance_double_combat_after_action",
                );
                if (advanceStatus === "timeout") {
                  throw new Error(`step_timeout:advance_double_combat_after_action:${STEP_TIMEOUT_MS}`);
                }
                if (advanceStatus === "terminal" && !game.isCurrentPhase("SelectModifierPhase")) {
                  const isMilestoneWaveContinuation = battleWaveIndexBeforeAction > 0
                    && battleWaveIndexBeforeAction % 10 === 0
                    && !isGameTerminalPhase(game)
                    && !game.isCurrentPhase("SelectModifierPhase");
                if (isMilestoneWaveContinuation) {
                  await withTimeout(
                    waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "post_terminal_to_next_battle_command_phase",
                  );
                  completedWaves += 1;
                  continue;
                }
                const isContinuousEncounterContinuation = isContinuousEncounterContinuationPhase(game);
                if (isContinuousEncounterContinuation) {
                  await withTimeout(
                    waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "continuous_encounter_command_ready",
                  );
                  continue;
                }
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

                    const phaseManager = game.scene.phaseManager;
                    const hasQueuedSelectModifier = phaseManager.hasPhaseOfType("SelectModifierPhase");
                    const hasQueuedNextBattle = phaseManager.hasPhaseOfType("NewBattlePhase")
                      || phaseManager.hasPhaseOfType("NextEncounterPhase")
                      || phaseManager.hasPhaseOfType("NewBiomeEncounterPhase")
                      || phaseManager.hasPhaseOfType("EncounterPhase");

                    if (hasQueuedSelectModifier) {
                      await withTimeout(
                        waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                        STEP_TIMEOUT_MS,
                        "battle_end_to_select_modifier_phase",
                      );
                      break;
                    }
                    if (hasQueuedNextBattle) {
                      await withTimeout(
                        game.phaseInterceptor.to("CommandPhase"),
                        STEP_TIMEOUT_MS,
                        "battle_end_to_next_battle_command_phase",
                      );
                      continue;
                    }
                    if (isGameTerminalPhase(game)) {
                      terminationReason = `combat_terminal:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                      break;
                    }
                    terminationReason = `unexpected_post_battle_queue:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                    break;
                  }
                  if (game.isCurrentPhase("EggLapsePhase")) {
                    await withTimeout(
                      waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                      STEP_TIMEOUT_MS,
                      "egg_lapse_to_select_modifier_phase",
                    );
                    break;
                  }
                  if (game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("PostGameOverPhase") || game.isCurrentPhase("TitlePhase")) {
                    terminationReason = "team_wipe_or_game_over";
                  } else {
                    terminationReason = `combat_terminal:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                  }
                  break;
                }
                continue;
              }
              if (!game.isCurrentPhase("CommandPhase")) {
                await withTimeout(
                  game.phaseInterceptor.to("CommandPhase"),
                  STEP_TIMEOUT_MS,
                  "single_to_command_phase",
                );
              }
              console.error(
                `[modifier-fixed-seed-single] pre-command-ready wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} phase=${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"} ui=${UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.())}`,
              );
              await waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS);
              console.error(
                `[modifier-fixed-seed-single] post-command-ready wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} phase=${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"} ui=${UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.())}`,
              );
              if (isCombatTerminalPhase(game)) {
                if (game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("PostGameOverPhase") || game.isCurrentPhase("TitlePhase")) {
                  terminationReason = "team_wipe_or_game_over";
                } else {
                  terminationReason = `combat_terminal:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                }
                break;
              }
              if (!game.isCurrentPhase("CommandPhase")) {
                throw new Error(`unexpected_combat_phase:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`);
              }

              const preparedPlayerPokemon = game.scene.getPlayerPokemon();
              const preparedEnemyPokemon = game.scene.getEnemyPokemon();
              const battleWaveIndexBeforeAction = game.scene.currentBattle?.waveIndex ?? 0;
              if (!preparedPlayerPokemon || !preparedEnemyPokemon) {
                throw new Error("missing_battlers_before_combat_action_selection");
              }
              const preparedPlayerSnapshot = buildBattlerSnapshot(preparedPlayerPokemon);
              const preparedEnemySnapshot = buildBattlerSnapshot(preparedEnemyPokemon);
              console.error(
                `[modifier-fixed-seed-single] building_state wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} player=${preparedPlayerSnapshot.species_name} enemy=${preparedEnemySnapshot.species_name}`,
              );
              const combatState = buildStateFromSnapshot(game);
              console.error(`[modifier-fixed-seed-single-state] ${JSON.stringify(combatState)}`);
              const actionMask = Array.isArray(combatState.action_mask)
                ? (combatState.action_mask as number[])
                : [];
              const loopGuardSelection = selectSingleBattleLoopGuardAction(combatTurns, actionMask);
              const struggleFallbackSelection = loopGuardSelection
                ? null
                : selectSingleBattleStruggleFallbackAction(game, actionMask);
              let selectedCombatAction: { action: number; actionSource: string };
              if (loopGuardSelection) {
                selectedCombatAction = loopGuardSelection;
              } else if (struggleFallbackSelection) {
                selectedCombatAction = struggleFallbackSelection;
              } else {
                selectedCombatAction = await withTimeout(
                  selectCombatActionFromMask(combatState, actionMask),
                  STEP_TIMEOUT_MS,
                  "combat_dqn_action_select",
                );
              }
              const { action, actionSource } = selectedCombatAction;
              if (action < 0) {
                terminationReason = "no_valid_combat_action";
                break;
              }

              if (!game.isCurrentPhase("CommandPhase")) {
                await sleep(25);
                continue;
              }

              const effectiveActionMaskForSnapshot = normalizeCombatActionMaskForSnapshot(
                actionMask,
                action,
                actionSource,
              );
              combatTurns.push(
                buildCombatDecisionSnapshot(
                  game,
                  combatState,
                  action,
                  actionSource,
                  preparedPlayerSnapshot,
                  preparedEnemySnapshot,
                  effectiveActionMaskForSnapshot,
                ),
              );
              executeCombatAction(game, action);

              const advanceStatus = await withTimeout(advanceCombatAfterAction(game), STEP_TIMEOUT_MS, "advance_combat_after_action");
              if (advanceStatus === "timeout") {
                throw new Error(`step_timeout:advance_combat_after_action:${STEP_TIMEOUT_MS}`);
              }
              if (advanceStatus === "terminal" && !game.isCurrentPhase("SelectModifierPhase")) {
                const isMilestoneWaveContinuation = battleWaveIndexBeforeAction > 0
                  && battleWaveIndexBeforeAction % 10 === 0
                  && !isGameTerminalPhase(game)
                  && !game.isCurrentPhase("SelectModifierPhase");
                if (isMilestoneWaveContinuation) {
                  await withTimeout(
                    waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "post_terminal_to_next_battle_command_phase",
                  );
                  completedWaves += 1;
                  continue;
                }
                const isContinuousEncounterContinuation = isContinuousEncounterContinuationPhase(game);
                if (isContinuousEncounterContinuation) {
                  await withTimeout(
                    waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "continuous_encounter_command_ready",
                  );
                  continue;
                }
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

                const phaseManager = game.scene.phaseManager;
                const hasQueuedSelectModifier = phaseManager.hasPhaseOfType("SelectModifierPhase");
                const hasQueuedNextBattle = phaseManager.hasPhaseOfType("NewBattlePhase")
                  || phaseManager.hasPhaseOfType("NextEncounterPhase")
                  || phaseManager.hasPhaseOfType("NewBiomeEncounterPhase")
                  || phaseManager.hasPhaseOfType("EncounterPhase");

                if (hasQueuedSelectModifier) {
                  await withTimeout(
                    waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "battle_end_to_select_modifier_phase",
                  );
                  break;
                }
                if (hasQueuedNextBattle) {
                  await withTimeout(
                    game.phaseInterceptor.to("CommandPhase"),
                    STEP_TIMEOUT_MS,
                    "battle_end_to_next_battle_command_phase",
                  );
                  continue;
                }
                if (isGameTerminalPhase(game)) {
                  terminationReason = `combat_terminal:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                  break;
                }
                terminationReason = `unexpected_post_battle_queue:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                break;
              }
                if (game.isCurrentPhase("EggLapsePhase")) {
                  await withTimeout(
                    waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "egg_lapse_to_select_modifier_phase",
                  );
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

            let modifierPhaseContinues = true;
            let firstModifierActionInWave = true;
            while (modifierPhaseContinues) {
              if (!game.isCurrentPhase("SelectModifierPhase")) {
                terminationReason = `expected_select_modifier_phase_but_got:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                break;
              }

              const modifierDecision = buildModifierDecisionSnapshot(game);
              expect(MODIFIER_POLICY).toBe("random_executable");
              const selectedAction = pickRandomExecutableAction(modifierDecision, random);
              selectedModifierActionForDebug = selectedAction;
              const immediateReward = calculateImmediateReward(modifierDecision, selectedAction, game);

              steps.push({
                step_index: steps.length,
                worker_id: WORKER_ID,
                decision_rng_seed: decisionRngSeed,
                wave_index: modifierDecision.wave_index,
                combat_turns: firstModifierActionInWave ? combatTurns : [],
                modifier_decision: modifierDecision,
                selected_action: selectedAction,
                selected_action_valid: modifierDecision.action_mask[selectedAction.action_index] === 1,
                immediate_reward: immediateReward,
              });

              const modifierOutcome = await withTimeout(
                executeModifierAction(game, selectedAction),
                STEP_TIMEOUT_MS,
                "execute_modifier_action",
              );
              firstModifierActionInWave = false;

              if (modifierOutcome === "command_phase") {
                completedWaves += 1;
                modifierPhaseContinues = false;
              }
            }
          }

          if (terminationReason === "unknown") {
            terminationReason = completedWaves >= MAX_WAVES ? "max_waves_reached" : "episode_loop_ended";
          }
        } catch (error) {
          if (terminationReason === "unknown") {
            terminationReason = error instanceof Error ? error.message : String(error);
          }
          if (error instanceof Error) {
            errorStack = error.stack;
          }
          errorDebug = buildTimeoutDebugSnapshot(game);
          if (selectedModifierActionForDebug) {
            errorDebug.selected_modifier_action = {
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
          if (terminationReason.startsWith("step_timeout:")) {
            timeoutDebug = errorDebug;
            console.error(
              `[modifier-fixed-seed-timeout] run=${runIndex} wave=${timeoutDebug.wave_index} phase=${timeoutDebug.phase_name} ui=${timeoutDebug.ui_mode} reason=${terminationReason}`,
            );
            console.error(JSON.stringify(timeoutDebug));
          } else {
            console.error(
              `[modifier-fixed-seed-error] run=${runIndex} attempt=${attemptIndex} reason=${terminationReason}`,
            );
            console.error(JSON.stringify(errorDebug));
            if (errorStack) {
              console.error(errorStack);
            }
          }
        } finally {
          game.phaseInterceptor.restoreOg();
        }

        const waveReached = completedWaves;
        const runtimeMs = Date.now() - runStartedAt;
        const localRewardSum = steps.reduce((sum, step) => sum + step.immediate_reward, 0);
        const terminalReward = calculateTerminalReward(waveReached);
        const shouldRetry = shouldRetryRun(terminationReason, waveReached, steps, attemptIndex);

        if (shouldRetry) {
          console.error(
            `[modifier-fixed-seed-retry] run=${runIndex} attempt=${attemptIndex} reason=${terminationReason}`,
          );
          continue;
        }

        recordedEpisode = {
          schema_version: SCHEMA_VERSION,
          run_index: runIndex,
          worker_id: WORKER_ID,
          decision_rng_seed: decisionRngSeed,
          seed: SEED,
          max_waves: MAX_WAVES,
          collector_variant: COLLECTOR_VARIANT,
          modifier_policy: MODIFIER_POLICY,
          runtime_ms: runtimeMs,
          completed_waves: completedWaves,
          wave_reached: waveReached,
          termination_reason: terminationReason,
          local_reward_sum: localRewardSum,
          terminal_reward: terminalReward,
          total_reward: localRewardSum + terminalReward,
          steps,
          retry_count: attemptIndex,
          timeout_debug: timeoutDebug,
          error_debug: errorDebug,
          error_stack: errorStack,
        };
        break;
      }

      if (!recordedEpisode) {
        throw new Error(`failed_to_record_episode:${runIndex}`);
      }

      episodes.push(recordedEpisode);
    }

    const averageWaveReached = episodes.reduce((sum, episode) => sum + episode.wave_reached, 0) / episodes.length;
    const averageTotalReward = episodes.reduce((sum, episode) => sum + episode.total_reward, 0) / episodes.length;

    const payload = {
      schema_version: SCHEMA_VERSION,
      seed: SEED,
      run_count: RUN_COUNT,
      max_waves: MAX_WAVES,
      collector_variant: COLLECTOR_VARIANT,
      worker_id: WORKER_ID,
      starter_config_id: STARTER_CONFIG_ID,
      starter_species: STARTER_SPECIES.map(speciesId => SpeciesId[speciesId] ?? String(speciesId)),
      decision_rng_strategy: "seed_plus_run_index",
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
  }, Math.max(300000, RUN_COUNT * MAX_WAVES * 6000));
});
