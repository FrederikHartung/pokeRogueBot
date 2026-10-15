import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface, type Interface } from "node:readline";
import { AbilityId } from "#enums/ability-id";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
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
import type { CommandUiHandler } from "#ui/command-ui-handler";
import { sendOutFromPartyUi } from "#test/porubot/harness/party-send-out";
import { PartyUiMode } from "#enums/party-ui-mode";
import { GameManager } from "#test/framework/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/utils/game-manager-utils";
import { modifierTypes } from "#data/data-lists";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { generateModifierType } from "#mystery-encounters/encounter-phase-utils";
import { SelectModifierPhase } from "#phases/select-modifier-phase";
import { PromptHandler } from "#test/helpers/prompt-handler";
import Phaser from "phaser";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  advanceCombatAfterAction,
  advanceDoubleCombatAfterAction,
  advanceCurrentUiPromptIfPossible,
  clearStalePromptsForForcedSwitch,
  getCommandFieldIndexSafe,
  getCurrentCommandPhaseFieldIndex,
  getRecoverableDoublePartnerCommandFieldIndex,
  hasAdvancedToFreshBattleCommandState,
  hasAdvancedToStableCommandState,
  hasAdvancedToStableSingleBattleCommandState,
  hasLoggedAnyPhaseSince,
  hasLoggedTerminalPhaseSince,
  hasRemainingPlayerTeam,
  isCombatTerminalPhase,
  isGameTerminalPhase,
  isSelectModifierResolutionPhase,
  isStableCommandInputState,
  isVictorySafe,
  normalizeCommandPhaseUiIfNeeded,
  resolveForcedSwitchIfNeeded,
  resolveLearnMoveIfNeeded,
  resolveOptionalCheckSwitchIfNeeded,
  sleep,
  waitForCommandOrTerminalAfterForcedSwitch,
  waitForDoubleFieldZeroFollowup,
  waitForDoubleTargetPhaseOrImmediateFollowup,
  waitForDoubleTargetSelectionResolution,
  waitForPostVictoryForcedSwitchResolution,
  waitForPromiseOrTerminal,
  withTimeout,
} from "#test/porubot/harness/battle-command-advance";
import { installSingleDriverPhaseInterceptor } from "#test/porubot/harness/single-driver-phase-interceptor";
import {
  setSwitchDecisionProvider,
  type SwitchDecisionKind,
  type SwitchDecisionResult,
} from "#test/porubot/harness/switch-decision";
import {
  buildCombatObservation as buildSharedCombatObservation,
  canBuildCombatObservation,
  type CombatDecisionHistory,
  type CombatObservation,
  contextFromHistory,
  type DecisionKind,
  emptyCombatDecisionHistory,
  findActivePartySlotIndex as findActiveSlotInObservation,
  resolveActivePlayerPokemon,
  updateCombatDecisionHistory,
} from "#bot-ts/combat-observation";
import {
  buildModifierObservation,
  type CandidateBlocker,
  type DecisionStage,
  type ModifierCandidate,
  type ModifierObservation,
} from "#bot-ts/modifier-observation";
import {
  getActionExecutability,
  getModifierTypeId,
  isSupportedHpRestoreShopItem,
  isSupportedReviveShopItem,
  isSupportedStatusHealShopItem,
  normalizeModifierTypeId,
} from "#bot-ts/modifier-collector-policy";
import { pickHeuristicV1CandidateIndex } from "#bot-ts/modifier-heuristic-policy";

/**
 * `random_executable`: reine Exploration. `heuristic_v1`: feste Regel (Benchmark-Vergleich).
 * `heuristic_mix_v1`: Trainingsdaten; pro Entscheidung mit HEURISTIC_MIX_RANDOM_SHARE Zufall, sonst heuristic_v1.
 */
type ModifierPolicy = "random_executable" | "heuristic_v1" | "heuristic_mix_v1";
const MODIFIER_POLICIES: readonly ModifierPolicy[] = ["random_executable", "heuristic_v1", "heuristic_mix_v1"];
/**
 * Anteil zufaelliger Entscheidungen in heuristic_mix_v1 (docs/modifier-state-v1-draft.md 2.4). Bei rund 23
 * Entscheidungen pro Run weicht ein Run etwa 7-mal ab; die Runs eines Seeds unterscheiden sich so, und die
 * Heuristik bringt sie weiter als reiner Zufall. Der Wurf nutzt den Entscheidungs-Zufall des Runs (reproduzierbar).
 */
const HEURISTIC_MIX_RANDOM_SHARE = 0.3;
type CollectorVariant = "sanity_masking" | "strategic_fixed_seed";
const SCHEMA_VERSION = "modifier_strategic_fixed_seed_output_v2";
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

/** modifier-transition-v1-Datensatz (docs/rl-schema/modifier-transition-v1.schema.json). */
type ModifierTransitionRecord = ModifierObservation & {
  selected_candidate_index: number;
  immediate_reward: number;
};

interface ModifierStepRecord {
  step_index: number;
  worker_id: string;
  decision_rng_seed: string;
  wave_index: number;
  combat_turns: CombatDecisionSnapshot[];
  modifier_transition: ModifierTransitionRecord;
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
  decision_stage: DecisionStage;
  candidate_index: number;
  kind: ModifierCandidate["kind"];
  item_id?: string;
  reward_index?: number;
  target_party_index?: number;
  target_move_index?: number;
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
  /** Text einer haengenden MessagePhase (privates Feld der Phase, nur zur Diagnose gelesen). */
  current_message_text: string | null;
  /** State und Ziel des PhaseInterceptors ("idling" = keine Phase wird gefahren). */
  phase_interceptor: string;
  selected_modifier_action?: SelectedModifierActionDebugSnapshot;
  party: PartyMemberDebugSnapshot[];
}

interface FixedBattleEntry {
  wave_index: number;
  party_hp_ratio_sum: number;
  alive_count: number;
}

/** Party-Zustand zu Kampfbeginn einer festen Welle; liest nur, beruehrt den Spiel-Zufall nicht. */
/**
 * Setzt den Spiel-Seed und haelt ihn fest. `classicMode.startBattle` ruft `generateStarters`
 * (pokerogue/test/utils/game-manager-utils.ts) auf, das `scene.seed` hart auf "test" setzt, nachdem
 * `game.override.seed()` gelaufen ist. Ohne diesen Schutz spielen alle Seeds dieselbe Welt (Befund 2026-10-15,
 * docs/pokerogue-headless-test-harness-mechanics.md 3.17). Andere Seed-Wechsel (setSeed) bleiben wirksam.
 */
const TEST_HARNESS_DEFAULT_SEED = "test";

function pinSceneSeed(game: GameManager, seed: string): void {
  game.override.seed(seed);
  const scene = game.scene;
  let currentSeed = scene.seed;
  Object.defineProperty(scene, "seed", {
    configurable: true,
    enumerable: true,
    get: () => currentSeed,
    set: (value: string) => {
      if (value === TEST_HARNESS_DEFAULT_SEED && seed !== TEST_HARNESS_DEFAULT_SEED) {
        return;
      }
      currentSeed = value;
    },
  });
}

function buildFixedBattleEntry(game: GameManager, waveIndex: number): FixedBattleEntry {
  const party = game.scene.getPlayerParty();
  const hpRatioSum = party.reduce(
    (sum, pokemon) => sum + (pokemon.isFainted() ? 0 : pokemon.hp / Math.max(1, pokemon.getMaxHp())),
    0,
  );
  return {
    wave_index: waveIndex,
    party_hp_ratio_sum: Math.round(hpRatioSum * 1000) / 1000,
    alive_count: party.filter(pokemon => !pokemon.isFainted()).length,
  };
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
  /** HP der Party zu Beginn fester Kaempfe (Rivale, Team Rocket, ...); Benchmark-Messgroesse. */
  fixed_battle_entries: FixedBattleEntry[];
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
if (!MODIFIER_POLICIES.includes(MODIFIER_POLICY)) {
  throw new Error(`Unsupported modifier policy: ${String(MODIFIER_POLICY)}`);
}
const COMBAT_DQN_CHECKPOINT = __COMBAT_DQN_CHECKPOINT__;
const COMBAT_DQN_DEVICE = __COMBAT_DQN_DEVICE__;
const COMBAT_DQN_PYTHON = __COMBAT_DQN_PYTHON__;
const COMBAT_DQN_WORKER_SCRIPT = __COMBAT_DQN_WORKER_SCRIPT__;
const STARTER_SPECIES = [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE];
const STEP_TIMEOUT_MS = __STEP_TIMEOUT_MS__;
/** Kaeufe pro Welle (ueber Rerolls hinweg), damit Zufallsruns nicht das ganze Geld verbrauchen (docs/modifier-state-v1-draft.md 2.4). */
const MAX_SHOP_PURCHASES = __MAX_SHOP_PURCHASES__;
/** Rerolls pro Welle; die Kosten verdoppeln sich je Reroll, die Grenze haelt Zufallsruns trotzdem knapp. */
const MAX_REROLLS_PER_WAVE = __MAX_REROLLS_PER_WAVE__;
/**
 * Nur `npm run rl:test:modifier:collector-actions`: gezielte Spieltests der Ausfuehrungspfade statt Datensammlung.
 * In normalen Collector-Laeufen sind sie aus, damit jeder Batch nur sammelt.
 */
const COLLECTOR_ACTION_TESTS = process.env.POKEROGUE_MODIFIER_COLLECTOR_ACTION_TESTS === "1";
const MAX_COMBAT_TURNS_PER_WAVE = 200;
/**
 * Vitest-Timeout des Sammel-Tests. Frueher RUN_COUNT * MAX_WAVES * 6 s (mindestens 5 min): Mit echten Seeds dauern
 * lange Runs deutlich laenger (Welle 24 nach ueber 5 min). Die harte Grenze pro Run setzt der Runner
 * (run_process_timeout_ms).
 */
const COLLECTION_TEST_TIMEOUT_MS = Math.max(4 * 60 * 60 * 1000, RUN_COUNT * MAX_WAVES * 60_000);
const FORCE_NORMALIZE_IVS = process.env.POKEROGUE_MODIFIER_FORCE_NORMALIZE_IVS === "1";
const FORCE_NORMALIZE_NATURES = process.env.POKEROGUE_MODIFIER_FORCE_NORMALIZE_NATURES === "1";
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
const SPECIES_STAT_BOOSTER_ELIGIBLE_SPECIES: Record<string, SpeciesId[]> = {
  LIGHT_BALL: [SpeciesId.PIKACHU],
  THICK_CLUB: [SpeciesId.CUBONE, SpeciesId.MAROWAK, SpeciesId.ALOLA_MAROWAK],
  METAL_POWDER: [SpeciesId.DITTO],
  QUICK_POWDER: [SpeciesId.DITTO],
  DEEP_SEA_SCALE: [SpeciesId.CLAMPERL],
  DEEP_SEA_TOOTH: [SpeciesId.CLAMPERL],
};
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
      // Inferenz: {"action": n}; describe: {"feature_schema_version": n}.
      const value = Number.isInteger(payload?.action) ? payload.action : payload?.feature_schema_version;
      if (Number.isInteger(value)) {
        pending.resolve(value);
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

function combatDqnPolicyConfig() {
  return {
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
  };
}

async function inferCombatActionWithDqn(state: Record<string, unknown>, actionMask: number[]): Promise<number> {
  return await runPersistentExternalPolicy(combatDqnPolicyConfig(), state, actionMask);
}

let combatDqnFeatureSchemaVersion: Promise<number> | null = null;

/** Feature-Version des Combat-Checkpoints (6 = combat-v3, 7 = combat-v4), einmal pro Prozess vom Worker erfragt. */
function getCombatDqnFeatureSchemaVersion(): Promise<number> {
  if (!combatDqnFeatureSchemaVersion) {
    const worker = getOrStartPersistentExternalPolicyWorker(combatDqnPolicyConfig());
    combatDqnFeatureSchemaVersion = withTimeout(
      new Promise<number>((resolve, reject) => {
        worker.pending.push({ resolve, reject });
        worker.child.stdin.write(JSON.stringify({ describe: true }) + "\n", "utf8");
      }),
      STEP_TIMEOUT_MS,
      "combat dqn describe",
    );
  }
  return combatDqnFeatureSchemaVersion;
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

function isEffectivelyDoubleBattle(game: GameManager, battle?: { double?: boolean } | null): boolean {
  if (battle?.double === true) {
    return true;
  }

  const playerActives = game.scene.getPlayerField(true).filter((pokemon: any) => pokemon != null && !pokemon.isFainted?.()).length;
  const enemyActives = game.scene.getEnemyField(true).filter((pokemon: any) => pokemon != null && !pokemon.isFainted?.()).length;

  return playerActives > 1 || enemyActives > 1 || getCommandFieldIndexSafe(game) > 0;
}

function getMoveTargetIndexForSubmission(game: GameManager, moveIndex: number, targetIndex?: BattlerIndex): BattlerIndex | undefined {
  const actingPokemon = getActingPlayerPokemon(game);
  const selectedMove = actingPokemon?.getMoveset?.()?.[moveIndex]?.getMove?.();
  if (selectedMove?.isMultiTarget?.()) {
    return undefined;
  }
  return targetIndex;
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

function isActiveTrappedSafe(pokemon: { isTrapped?: () => boolean } | null | undefined): boolean {
  try {
    return pokemon?.isTrapped?.() === true;
  } catch {
    return false;
  }
}

// combat-v4-Observation aus dem gemeinsamen Builder (src/main/ts/lib/combat-observation.ts), wie im Szenario-Collector
// und in der JS-Bridge des Live-Bots. Der Verlauf (letzte Entscheidung ein Wechsel, Wechselkette, Herkunfts-Slot) gilt
// pro Kampf und wird beim Wellenwechsel zurueckgesetzt.
const COMBAT_V4_FEATURE_SCHEMA_VERSION = 7;

interface CombatDecisionTracker {
  history: CombatDecisionHistory;
  waveIndex: number;
  /** Combat-Turn-Snapshots der Wechsel-Entscheidungen aus dem Harness-Hook; die Kampfschleife haengt sie an. */
  switchSnapshots: CombatDecisionSnapshot[];
}

const combatDecisionTracker: CombatDecisionTracker = {
  history: emptyCombatDecisionHistory(),
  waveIndex: -1,
  switchSnapshots: [],
};

function resetCombatDecisionTracker(): void {
  combatDecisionTracker.history = emptyCombatDecisionHistory();
  combatDecisionTracker.waveIndex = -1;
  combatDecisionTracker.switchSnapshots = [];
}

function currentCombatHistory(game: GameManager): CombatDecisionHistory {
  const waveIndex = game.scene.currentBattle?.waveIndex ?? -1;
  if (waveIndex !== combatDecisionTracker.waveIndex) {
    combatDecisionTracker.history = emptyCombatDecisionHistory();
    combatDecisionTracker.waveIndex = waveIndex;
  }
  return combatDecisionTracker.history;
}

function buildCombatObservation(game: GameManager, decisionKind: DecisionKind = 0): Record<string, unknown> {
  const observation = buildSharedCombatObservation(game.scene, contextFromHistory(currentCombatHistory(game), decisionKind));
  return observation as unknown as Record<string, unknown>;
}

function recordCombatDecision(game: GameManager, state: Record<string, unknown>, decisionKind: DecisionKind, action: number): void {
  const activeSlot = findActiveSlotInObservation({ party_slots: state.party_slots as CombatObservation["party_slots"] });
  combatDecisionTracker.history = updateCombatDecisionHistory(currentCombatHistory(game), decisionKind, action, activeSlot);
}

function drainSwitchDecisionSnapshots(): CombatDecisionSnapshot[] {
  return combatDecisionTracker.switchSnapshots.splice(0);
}

/**
 * Harness-Hook (switch-decision.ts): Zwangswechsel nach K.O. und Wechselangebot zu Kampfbeginn entscheidet das
 * Combat-DQN, sofern der Checkpoint den combat-v4-State kennt. null = Harness-Standard (erster gueltiger Slot bzw.
 * ablehnen): bei v3-Checkpoints, Doppelkaempfen, nach dem Sieg und ohne aktiven Gegner.
 */
async function decideSwitchWithCombatDqn(game: GameManager, kind: SwitchDecisionKind): Promise<SwitchDecisionResult> {
  if (game.scene.currentBattle?.double || !canBuildCombatObservation(game.scene) || isVictorySafe(game)) {
    return null;
  }
  if ((await getCombatDqnFeatureSchemaVersion()) < COMBAT_V4_FEATURE_SCHEMA_VERSION) {
    return null;
  }
  const decisionKind: DecisionKind = kind === "forced_switch" ? 1 : 2;
  const state = buildCombatObservation(game, decisionKind);
  const actionMask = state.action_mask as number[];
  if (!actionMask.some(value => value === 1)) {
    return null;
  }
  const { action, actionSource } = await selectCombatActionFromMask(state, actionMask);
  if (action < MOVE_ACTIONS) {
    return null;
  }
  const activePokemon = resolveActivePlayerPokemon(game.scene);
  const enemyPokemon = game.scene.getEnemyPokemon();
  if (activePokemon && enemyPokemon) {
    combatDecisionTracker.switchSnapshots.push(
      buildCombatDecisionSnapshot(
        game,
        state,
        action,
        actionSource,
        buildBattlerSnapshot(activePokemon),
        buildBattlerSnapshot(enemyPokemon),
      ),
    );
  }
  recordCombatDecision(game, state, decisionKind, action);
  const slot = action - MOVE_ACTIONS;
  const partySlots = state.party_slots as Array<{ active: number }>;
  return decisionKind === 2 && partySlots[slot]?.active === 1 ? "stay" : slot;
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

/**
 * Sperren des Collectors zusaetzlich zu den Spielregeln des Builders: was die Ausfuehrung noch nicht kann
 * (getActionExecutability) und Zusatzregeln fuer Kauf, Ziel und Reroll-Grenze. Lock ist noch nicht umgesetzt.
 */
function createCollectorCandidateBlocker(game: GameManager, rerollsThisWave: number): CandidateBlocker {
  return (candidate, option) => {
    if (candidate.kind === "toggle_lock_rarities") {
      return "not_implemented_in_collector";
    }
    if (candidate.kind === "reroll") {
      return rerollsThisWave >= MAX_REROLLS_PER_WAVE ? "reroll_limit_reached" : null;
    }
    if (!option || (candidate.kind !== "take_reward" && candidate.kind !== "buy_shop_item")) {
      return null;
    }
    // Die bestehenden Regeln arbeiten auf dem UI-Objekt (ModifierOption mit modifierTypeOption).
    const uiOption = { modifierTypeOption: option };
    if (candidate.kind === "buy_shop_item") {
      const availability = getActionAvailability(game, uiOption);
      if (!availability.available) {
        return availability.reason ?? "unavailable";
      }
    }
    const executability = getActionExecutability(candidate.kind, uiOption);
    if (!executability.executable) {
      return executability.reason ?? "not_executable";
    }
    if (candidate.target_party_index !== undefined) {
      const target = getRewardTargetAvailability(game, uiOption, candidate.target_party_index);
      if (!target.available) {
        return target.reason ?? "target_unavailable";
      }
    }
    return null;
  };
}

/** Oeffentliche Methode und privater Zaehler der SelectModifierPhase; die Klasse ist hier nur strukturell noetig. */
interface SelectModifierPhaseLike {
  getRerollCost(lockRarities: boolean): number;
  rerollCount?: number;
}

function buildCollectorObservation(
  game: GameManager,
  stage: DecisionStage,
  purchasesThisPhase: number,
  rerollsThisWave: number,
): ModifierObservation {
  const handler = getModifierHandler(game);
  const phase = game.scene.phaseManager.getCurrentPhase() as unknown as SelectModifierPhaseLike;
  return buildModifierObservation({
    scene: game.scene,
    decisionStage: stage,
    rewardOptions: handler.options.map(option => option.modifierTypeOption),
    shopRows: handler.shopOptionsRows.map(row => row.map(option => option.modifierTypeOption)),
    rerollCost: phase.getRerollCost(game.scene.lockModifierTiers),
    rerollCount: phase.rerollCount ?? 0,
    purchasesThisPhase,
    blockCandidate: createCollectorCandidateBlocker(game, rerollsThisWave),
  });
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
  const observation = buildCollectorObservation(game, "reward", 0);
  return {
    wave_index: observation.state.run.wave_index,
    money: game.scene.money,
    offer: observation.state.offer,
    reward_candidates: observation.candidates.map(candidate => ({
      kind: candidate.kind,
      item_id: candidate.item_id,
      target_party_index: candidate.target_party_index,
      target_move_index: candidate.target_move_index,
      mask: candidate.mask,
      mask_reason: candidate.mask_reason,
    })),
    party: game.scene.getPlayerParty().map((pokemon: any) => buildPartyMemberDebugSnapshot(pokemon)),
  };
}

function describePhaseInterceptor(game: GameManager): string {
  const interceptor = game.phaseInterceptor as unknown as { state?: string; target?: string };
  const handler = game.scene.ui.getHandler() as unknown as { constructor?: { name?: string } } | undefined;
  return `state=${interceptor.state ?? "?"} target=${interceptor.target ?? "?"} handler=${handler?.constructor?.name ?? "?"}`;
}

function readCurrentMessageText(game: GameManager): string | null {
  const phase = game.scene.phaseManager?.getCurrentPhase?.() as unknown as { phaseName?: string; text?: unknown } | undefined;
  if (phase?.phaseName !== "MessagePhase" || typeof phase.text !== "string") return null;
  const interceptor = game.phaseInterceptor as unknown as { state?: string; target?: string };
  const handler = game.scene.ui.getHandler() as unknown as { awaitingActionInput?: boolean; pendingPrompt?: boolean } | undefined;
  return `${phase.text} [interceptor=${interceptor.state ?? "?"} target=${interceptor.target ?? "?"} awaitingInput=${String(handler?.awaitingActionInput)} pendingPrompt=${String(handler?.pendingPrompt)} queue=${game.scene.phaseManager.getCurrentPhase()?.phaseName}]`;
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
    current_message_text: readCurrentMessageText(game),
    phase_interceptor: describePhaseInterceptor(game),
    party: game.scene.getPlayerParty().map((pokemon: any) => buildPartyMemberDebugSnapshot(pokemon)),
  };
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

  const allRecentActionsAreSwitches = recentTurns.every(
    turn => !turn.is_double_battle
      && turn.selected_action >= MOVE_ACTIONS
      && Number((turn.state as Record<string, unknown>)?.decision_kind ?? 0) === 0,
  );
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
  game.selectTarget(actionIndex, getMoveTargetIndexForSubmission(game, actionIndex, targetIndex));
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

// Wechsel ueber sendOutFromPartyUi aus dem Harness statt GameManager.doSwitchPokemon: dessen blinde ACTION-Folge
// oeffnet bei liegengebliebenen Party-Optionen (z. B. nach Item-Auswahl im Shop) die Uebersicht (SUMMARY, Signatur E).
function selectSwitchByPartyIndex(game: GameManager, partyIndex: number): void {
  game.onNextPrompt("CommandPhase", UiMode.COMMAND, () => {
    const commandHandler = game.scene.ui.getHandler() as CommandUiHandler;
    commandHandler.setCursor(2);
    commandHandler.processInput(Button.ACTION);
  });
  game.onNextPrompt("CommandPhase", UiMode.PARTY, () => {
    sendOutFromPartyUi(game, partyIndex);
  });
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
  targetMoveIndex?: number,
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

    if (partyUiMode === PartyUiMode.MODIFIER || partyUiMode === PartyUiMode.MOVE_MODIFIER) {
      const isMoveModifier = partyUiMode === PartyUiMode.MOVE_MODIFIER;
      if (isMoveModifier && targetMoveIndex == null) {
        throw new Error("Move modifier reward requires a target_move_index");
      }
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
      if (isMoveModifier) {
        // Das Optionsmenue listet MOVE_1..MOVE_n in Attacken-Reihenfolge; setCursor setzt im Optionsmodus den Options-Cursor.
        if (!partyHandler.optionsMode) {
          throw new Error("Move modifier options menu did not open");
        }
        partyHandler.setCursor(targetMoveIndex);
        if (partyHandler.optionsCursor !== targetMoveIndex) {
          throw new Error(`Move modifier option cursor mismatch: ${String(partyHandler.optionsCursor)} vs ${String(targetMoveIndex)}`);
        }
      }
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

async function executeTakeRewardAction(
  game: GameManager,
  rewardIndex: number,
  targetPartyIndex?: number,
  targetMoveIndex?: number,
): Promise<"command_phase"> {
  const followupMode = await selectModifierOptionAndResolvePartyTarget(
    game,
    toRewardRowCursor(),
    rewardIndex,
    targetPartyIndex,
    targetMoveIndex,
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

/**
 * Reroll ueber die untere Zeile (ShopCursorTarget.REROLL, Spalte 0). Das Spiel beendet die Phase und schiebt eine neue
 * SelectModifierPhase mit rerollCount + 1 ein. Die neue Phase wird zwar "current", startet im Testharness aber erst
 * ueber phaseInterceptor.to(...) (docs/pokerogue-headless-test-harness-mechanics.md, 3.7); das uebernimmt
 * waitForSelectModifierPhaseReady, sobald die alte Phase beendet ist.
 */
async function executeRerollAction(game: GameManager): Promise<"modifier_select"> {
  await waitForModifierInputReady(game);
  const previousPhase = game.scene.phaseManager.getCurrentPhase();
  const handler = getModifierHandler(game);
  handler.setRowCursor(ShopCursorTarget.REROLL);
  handler.setCursor(0);
  if (!handler.processInput(Button.ACTION)) {
    throw new Error("Reroll was rejected by the modifier select handler");
  }

  const startedAt = Date.now();
  while (game.scene.phaseManager.getCurrentPhase() === previousPhase) {
    if (Date.now() - startedAt >= STEP_TIMEOUT_MS) {
      throw new Error(`step_timeout:reroll_phase_end:${STEP_TIMEOUT_MS}`);
    }
    await sleep(25);
  }
  if (!game.isCurrentPhase("SelectModifierPhase")) {
    const phaseName = game.scene.phaseManager.getCurrentPhase()?.constructor?.name ?? "unknown";
    throw new Error(`reroll_unexpected_phase:${phaseName}`);
  }
  await waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS);
  await waitForModifierInputReady(game);
  return "modifier_select";
}

async function executeModifierCandidate(
  game: GameManager,
  candidate: ModifierCandidate,
): Promise<"modifier_select" | "command_phase"> {
  switch (candidate.kind) {
    case "skip":
      await executeSkipAction(game);
      return "command_phase";
    case "take_reward":
      if (candidate.reward_index == null) {
        throw new Error("Reward candidate missing reward_index");
      }
      return executeTakeRewardAction(game, candidate.reward_index, candidate.target_party_index, candidate.target_move_index);
    case "buy_shop_item":
      if (candidate.shop_row_index == null || candidate.shop_column_index == null) {
        throw new Error("Shop candidate missing shop coordinates");
      }
      return executeBuyShopItemAction(
        game,
        candidate.shop_row_index,
        candidate.shop_column_index,
        candidate.target_party_index,
      );
    case "finish_shop":
      // Keine Spieleingabe: die Phase bleibt offen, es folgt die Gratis-Wahl.
      return "modifier_select";
    case "reroll":
      return executeRerollAction(game);
    default:
      throw new Error(`Modifier candidate kind not executable in collector: ${candidate.kind}`);
  }
}

/**
 * Exploration: erst gleichverteilt eine Wahl (Gratis-Belohnung, Shop-Platz, finish_shop, skip, ...), dann gleichverteilt
 * ein gueltiges Ziel. Sonst wuerden Items mit vielen Zielen (Party x Attacke) uebergewichtet.
 */
function pickRandomCandidateIndex(observation: ModifierObservation, random: () => number): number {
  const groups = new Map<string, number[]>();
  observation.candidates.forEach((candidate, index) => {
    if (candidate.mask !== 1) {
      return;
    }
    const key = [candidate.kind, candidate.reward_index, candidate.shop_row_index, candidate.shop_column_index].join(":");
    const group = groups.get(key);
    if (group) {
      group.push(index);
    } else {
      groups.set(key, [index]);
    }
  });
  const choices = [...groups.values()];
  if (choices.length === 0) {
    throw new Error("No executable modifier candidates available");
  }
  const choice = choices[Math.floor(random() * choices.length)]!;
  return choice[Math.floor(random() * choice.length)]!;
}

function selectModifierCandidateIndex(observation: ModifierObservation, random: () => number): number {
  switch (MODIFIER_POLICY) {
    case "random_executable":
      return pickRandomCandidateIndex(observation, random);
    case "heuristic_v1":
      return pickHeuristicV1CandidateIndex(observation);
    case "heuristic_mix_v1":
      return random() < HEURISTIC_MIX_RANDOM_SHARE
        ? pickRandomCandidateIndex(observation, random)
        : pickHeuristicV1CandidateIndex(observation);
  }
}

const HEAL_FAMILIES = new Set(["heal_hp", "revive", "revive_all"]);

/**
 * Sofort-Reward nur fuer klar messbare Effekte (docs/modifier-state-v1-draft.md Abschnitt 5): geheilter bzw.
 * wiederbelebter Anteil, kleiner Malus fuer bezahlte Heilung, wenn eine Gratis-Heilung angeboten wird.
 */
function calculateImmediateReward(observation: ModifierObservation, candidate: ModifierCandidate): number {
  const family = candidate.item_family;
  if (!family || !HEAL_FAMILIES.has(family)) {
    return 0;
  }
  let reward = candidate.effect?.hp_restore_ratio ?? 0;
  if (family === "revive_all") {
    const present = observation.state.party_slots.filter(slot => slot.present === 1).length;
    const fainted = observation.state.party_slots.filter(slot => slot.fainted === 1).length;
    reward = present > 0 ? fainted / present : 0;
  }
  if (
    candidate.kind === "buy_shop_item"
    && observation.state.offer.some(item => item.source === "reward" && HEAL_FAMILIES.has(item.item_family))
  ) {
    reward -= 0.1;
  }
  return reward;
}

function toSelectedCandidateDebug(observation: ModifierObservation, candidateIndex: number): SelectedModifierActionDebugSnapshot {
  const candidate = observation.candidates[candidateIndex]!;
  return {
    decision_stage: observation.decision_stage,
    candidate_index: candidateIndex,
    kind: candidate.kind,
    item_id: candidate.item_id,
    reward_index: candidate.reward_index,
    target_party_index: candidate.target_party_index,
    target_move_index: candidate.target_move_index,
    shop_row_index: candidate.shop_row_index,
    shop_column_index: candidate.shop_column_index,
    cost: candidate.cost,
  };
}

function calculateTerminalReward(waveReached: number): number {
  return waveReached.toString() === "NaN" ? 0 : waveReached;
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

  async function openSelectModifierPhaseWithRewards(game: GameManager, rewards: ModifierTypeOption[]): Promise<void> {
    initSceneWithoutEncounterPhase(game.scene, STARTER_SPECIES);
    const [bulbasaur, charmander, squirtle] = game.scene.getPlayerParty();
    bulbasaur?.tryPopulateMoveset([MoveId.TACKLE, MoveId.GROWL, MoveId.VINE_WHIP]);
    charmander?.tryPopulateMoveset([MoveId.SCRATCH, MoveId.GROWL, MoveId.EMBER]);
    squirtle?.tryPopulateMoveset([MoveId.TACKLE, MoveId.TAIL_WHIP, MoveId.WATER_GUN]);
    game.scene.phaseManager.unshiftPhase(new SelectModifierPhase(0, undefined, { guaranteedModifierTypeOptions: rewards }));
    await game.phaseInterceptor.to("SelectModifierPhase");
    await waitForModifierInputReady(game);
  }

  async function waitForCondition(condition: () => boolean, description: string): Promise<void> {
    const startedAt = Date.now();
    while (!condition()) {
      if (Date.now() - startedAt > 5000) {
        throw new Error(`Timed out waiting for ${description}`);
      }
      await sleep(25);
    }
  }

  // Attacken-Ziel-Belohnungen ueber denselben UI-Pfad wie im Collector (Party-Slot, dann Attacke im Optionsmenue).
  it.runIf(COLLECTOR_ACTION_TESTS)("collector action: ETHER restores PP of the chosen move only", async () => {
    const game = new GameManager(phaserGame);
    const ether = generateModifierType(modifierTypes.ETHER);
    if (!ether) {
      throw new Error("Failed to generate ETHER");
    }
    await openSelectModifierPhaseWithRewards(game, [new ModifierTypeOption(ether, 0)]);
    const target = game.scene.getPlayerParty()[1]!;
    const moveset = target.getMoveset();
    moveset[0]!.ppUsed = 3;
    moveset[1]!.ppUsed = 5;

    const observation = buildCollectorObservation(game, "reward", 0, 0);
    const candidate = observation.candidates.find(
      entry => entry.kind === "take_reward" && entry.target_party_index === 1 && entry.target_move_index === 1,
    );
    expect(candidate?.mask).toBe(1);

    await selectModifierOptionAndResolvePartyTarget(game, toRewardRowCursor(), 0, 1, 1);
    await waitForCondition(() => moveset[1]!.ppUsed === 0, "ETHER to restore move 1");
    expect(moveset[0]!.ppUsed).toBe(3);
  });

  it.runIf(COLLECTOR_ACTION_TESTS)("collector action: PP_UP raises PP of the chosen move only", async () => {
    const game = new GameManager(phaserGame);
    const ppUp = generateModifierType(modifierTypes.PP_UP);
    if (!ppUp) {
      throw new Error("Failed to generate PP_UP");
    }
    await openSelectModifierPhaseWithRewards(game, [new ModifierTypeOption(ppUp, 0)]);
    const moveset = game.scene.getPlayerParty()[2]!.getMoveset();
    const ppUpBefore = moveset.map(move => move.ppUp);

    const observation = buildCollectorObservation(game, "reward", 0, 0);
    const candidate = observation.candidates.find(
      entry => entry.kind === "take_reward" && entry.target_party_index === 2 && entry.target_move_index === 2,
    );
    expect(candidate?.mask).toBe(1);

    await selectModifierOptionAndResolvePartyTarget(game, toRewardRowCursor(), 0, 2, 2);
    await waitForCondition(() => moveset[2]!.ppUp === ppUpBefore[2]! + 1, "PP_UP on move 2");
    expect(moveset.map(move => move.ppUp)).toEqual(ppUpBefore.map((value, index) => (index === 2 ? value + 1 : value)));
  });

  it.skipIf(COLLECTOR_ACTION_TESTS)("collects repeated fixed-seed modifier runs", async () => {
    const episodes: EpisodeRecord[] = [];

    for (let localRunIndex = 0; localRunIndex < RUN_COUNT; localRunIndex += 1) {
      const runIndex = RUN_INDEX_OFFSET + localRunIndex;
      let recordedEpisode: EpisodeRecord | null = null;

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        if (attemptIndex > 0) {
          // Ein Retry legt einen zweiten GameManager im selben Test an. Seit v1.12 geht der Harness von einem
          // GameManager pro Test aus; ohne dieses Aufraeumen wirft das statische PromptHandler-Intervall und
          // die Spies verschachteln sich (gleiches Problem wie im Combat-Collector).
          clearInterval(PromptHandler.runInterval);
          PromptHandler.runInterval = undefined;
          vi.restoreAllMocks();
        }
        const game = new GameManager(phaserGame);
        // This collector deliberately leaves earlier phaseInterceptor.to() calls
        // pending (background toNextTurn(), recovery pumps, ...); without this,
        // those turn into competing "zombie" phase drivers that double-start
        // phases and skip queued ones - see
        // docs/pokerogue-headless-test-harness-mechanics.md.
        installSingleDriverPhaseInterceptor(game);
        resetCombatDecisionTracker();
        setSwitchDecisionProvider(game, decideSwitchWithCombatDqn);

        pinSceneSeed(game, SEED);

        if (COLLECTOR_VARIANT === "sanity_masking") {
          game.override
            .disableTrainerWaves()
            .enemySpecies(SpeciesId.MAGIKARP)
            .enemyMoveset(MoveId.SPLASH);
        }

        if (COLLECTOR_VARIANT === "strategic_fixed_seed") {
          // Keep real seeded encounters for strategic data generation and
          // avoid a train/serve mismatch from test-helper normalized IVs/natures.
          if (!FORCE_NORMALIZE_IVS) {
            game.override.normalizeIVs = false;
          }
          if (!FORCE_NORMALIZE_NATURES) {
            game.override.normalizeNatures = false;
          }
        }

        const random = createDeterministicRandom(`${SEED}::${runIndex}`);
        const decisionRngSeed = `${SEED}::${runIndex}`;
        const steps: ModifierStepRecord[] = [];
        const fixedBattleEntries: FixedBattleEntry[] = [];
        let completedWaves = 0;
        let terminationReason = "unknown";
        let timeoutDebug: TimeoutDebugSnapshot | undefined;
        let errorDebug: TimeoutDebugSnapshot | undefined;
        let errorStack: string | undefined;
        let selectedModifierActionForDebug: SelectedModifierActionDebugSnapshot | undefined;
        const runStartedAt = Date.now();

        try {
          await game.classicMode.startBattle(...STARTER_SPECIES);
          if (game.scene.seed !== SEED) {
            throw new Error(`seed_not_applied:${game.scene.seed}`);
          }
          applyWaveLibW1StarterLayout(game);

          while (completedWaves < MAX_WAVES) {
            const combatTurns: CombatDecisionSnapshot[] = [];
            while (!game.isCurrentPhase("SelectModifierPhase")) {
              if (isSelectModifierResolutionPhase(game)) {
                await withTimeout(
                  waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                  STEP_TIMEOUT_MS,
                  "post_battle_resolution_to_select_modifier_phase",
                );
                break;
              }
              const currentBattle = game.scene.currentBattle;
              if (!currentBattle) {
                terminationReason = "missing_current_battle";
                break;
              }
              if (
                game.scene.gameMode.isFixedBattle(currentBattle.waveIndex)
                && !fixedBattleEntries.some(entry => entry.wave_index === currentBattle.waveIndex)
              ) {
                fixedBattleEntries.push(buildFixedBattleEntry(game, currentBattle.waveIndex));
              }
              if (isCombatTerminalPhase(game) && !game.isCurrentPhase("SelectModifierPhase")) {
                if (game.isCurrentPhase("BattleEndPhase")) {
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
                if (isSelectModifierResolutionPhase(game)) {
                  await withTimeout(
                    waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "post_battle_resolution_to_select_modifier_phase",
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
              if ((currentBattle.turn ?? 0) > MAX_COMBAT_TURNS_PER_WAVE) {
                throw new Error(`step_timeout:combat_turn_limit:${MAX_COMBAT_TURNS_PER_WAVE}`);
              }
              if (isEffectivelyDoubleBattle(game, currentBattle)) {
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

                const advanceStatus = await advanceDoubleCombatAfterAction(game, selectedDoubleAction, STEP_TIMEOUT_MS);
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
                  if (isSelectModifierResolutionPhase(game)) {
                    await withTimeout(
                      waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                      STEP_TIMEOUT_MS,
                      "post_battle_resolution_to_select_modifier_phase",
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
              console.error(
                `[modifier-fixed-seed-single] pre-command-ready wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} phase=${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"} ui=${UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.())}`,
              );
              await waitForCombatCommandInputReady(game, STEP_TIMEOUT_MS);
              console.error(
                `[modifier-fixed-seed-single] post-command-ready wave=${game.scene.currentBattle?.waveIndex ?? "unknown"} turn=${game.scene.currentBattle?.turn ?? "unknown"} phase=${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"} ui=${UiMode[game.scene.ui?.getMode?.() as number] ?? String(game.scene.ui?.getMode?.())}`,
              );
              if (isEffectivelyDoubleBattle(game, game.scene.currentBattle)) {
                continue;
              }
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
              combatTurns.push(...drainSwitchDecisionSnapshots());
              recordCombatDecision(game, combatState, 0, action);
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

              const advanceStatus = await advanceCombatAfterAction(game, STEP_TIMEOUT_MS);
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
                if (isSelectModifierResolutionPhase(game)) {
                  await withTimeout(
                    waitForSelectModifierPhaseReady(game, STEP_TIMEOUT_MS),
                    STEP_TIMEOUT_MS,
                    "post_battle_resolution_to_select_modifier_phase",
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
            // Kaufgrenze und Reroll-Grenze gelten pro Welle, also ueber Rerolls hinweg.
            let purchasesThisPhase = 0;
            let rerollsThisWave = 0;
            let decisionStage: DecisionStage = "shop";
            while (modifierPhaseContinues) {
              if (!game.isCurrentPhase("SelectModifierPhase")) {
                terminationReason = `expected_select_modifier_phase_but_got:${game.scene.phaseManager?.getCurrentPhase?.()?.constructor?.name ?? "unknown"}`;
                break;
              }

              // Zwei Stufen wie im Spiel: erst kaufen (bis finish_shop oder Kaufgrenze), dann Gratis-Wahl.
              const observation = buildCollectorObservation(game, decisionStage, purchasesThisPhase, rerollsThisWave);
              if (
                decisionStage === "shop"
                && (purchasesThisPhase >= MAX_SHOP_PURCHASES
                  || !observation.candidates.some(candidate => candidate.kind === "buy_shop_item" && candidate.mask === 1))
              ) {
                // Nur finish_shop waere waehlbar: keine Entscheidung, kein Datensatz.
                decisionStage = "reward";
                continue;
              }

              combatTurns.push(...drainSwitchDecisionSnapshots());
              const selectedIndex = selectModifierCandidateIndex(observation, random);
              const selectedCandidate = observation.candidates[selectedIndex]!;
              selectedModifierActionForDebug = toSelectedCandidateDebug(observation, selectedIndex);
              const immediateReward = calculateImmediateReward(observation, selectedCandidate);

              steps.push({
                step_index: steps.length,
                worker_id: WORKER_ID,
                decision_rng_seed: decisionRngSeed,
                wave_index: observation.state.run.wave_index,
                combat_turns: firstModifierActionInWave ? combatTurns : [],
                modifier_transition: {
                  ...observation,
                  selected_candidate_index: selectedIndex,
                  immediate_reward: immediateReward,
                },
              });
              firstModifierActionInWave = false;

              if (selectedCandidate.kind === "finish_shop") {
                decisionStage = "reward";
                continue;
              }

              const modifierOutcome = await withTimeout(
                executeModifierCandidate(game, selectedCandidate),
                STEP_TIMEOUT_MS,
                "execute_modifier_action",
              );
              if (selectedCandidate.kind === "buy_shop_item") {
                purchasesThisPhase += 1;
              }
              if (selectedCandidate.kind === "reroll") {
                // Neues Angebot in einer neuen SelectModifierPhase: wieder erst Shop, dann Gratis-Wahl.
                rerollsThisWave += 1;
                decisionStage = "shop";
                continue;
              }

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
            errorDebug.selected_modifier_action = selectedModifierActionForDebug;
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
        }

        const waveReached = completedWaves;
        const runtimeMs = Date.now() - runStartedAt;
        const localRewardSum = steps.reduce((sum, step) => sum + step.modifier_transition.immediate_reward, 0);
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
          fixed_battle_entries: fixedBattleEntries,
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
      max_shop_purchases_per_phase: MAX_SHOP_PURCHASES,
      max_rerolls_per_wave: MAX_REROLLS_PER_WAVE,
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
  }, COLLECTION_TEST_TIMEOUT_MS);
});
