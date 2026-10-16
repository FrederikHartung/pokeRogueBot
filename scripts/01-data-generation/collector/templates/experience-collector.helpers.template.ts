import { spawn, spawnSync as spawnSyncChild } from "node:child_process";
import { createInterface } from "node:readline";
import { getGameMode } from "#app/game-mode";
import { Gender } from "#data/gender";
import { allAbilities } from "#data/data-lists";
import { BattleStyle } from "#enums/battle-style";
import { BattleType } from "#enums/battle-type";
import { BattlerIndex } from "#enums/battler-index";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { GameModes } from "#enums/game-modes";
import { MoveCategory } from "#enums/move-category";
import { MoveUseMode } from "#enums/move-use-mode";
import { Nature } from "#enums/nature";
import { StatusEffect } from "#enums/status-effect";
import { TrainerSlot } from "#enums/trainer-slot";
import { TrainerType } from "#enums/trainer-type";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { EncounterPhase } from "#phases/encounter-phase";
import { SelectStarterPhase } from "#phases/select-starter-phase";
import type { GameManager } from "#test/framework/game-manager";
import { generateStarters } from "#test/utils/game-manager-utils";
import { PartyUiMode } from "#enums/party-ui-mode";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import {
  clearStalePromptsForForcedSwitch,
  resolveForcedSwitchIfNeeded,
  resolveLearnMoveIfNeeded,
  resolveOptionalCheckSwitchIfNeeded,
} from "#test/porubot/harness/battle-command-advance";
import { setSwitchDecisionProvider } from "#test/porubot/harness/switch-decision";
import { PokemonType } from "#enums/pokemon-type";
import { WeatherType } from "#enums/weather-type";
import { TerrainType } from "#data/terrain";
import type { CommandUiHandler } from "#ui/command-ui-handler";
import type { PartyUiHandler } from "#ui/party-ui-handler";
import { sendOutFromPartyUi } from "#test/porubot/harness/party-send-out";
import {
  accuracyBucket,
  actsFirstIfUsed,
  assertCombatObservationEnumParity,
  bucketByThresholds,
  buildCombatObservation,
  canBuildCombatObservation,
  type CombatDecisionHistory,
  type CombatObservation,
  contextFromHistory,
  countBucket,
  damageClassBucket,
  damageRatioBucket,
  type DecisionKind,
  effectivenessBucket,
  emptyCombatDecisionHistory,
  estimateDamageRatio,
  getBestKnownEnemyPriority,
  getEffectiveSpeed,
  getHpRatio,
  hpBucket,
  hpDiffBucket,
  koTurnsBucket,
  levelGapBucket,
  moveKindBucket,
  powerBucket,
  priorityBucket,
  speedOrderAdvantage,
  updateCombatDecisionHistory,
  usesBestOffenseStat,
} from "#bot-ts/combat-observation";

const TERMINAL_ON_EGG_LAPSE = "__COLLECTOR_TERMINAL_ON_EGG_LAPSE__" === "true";
const STEP_TIMEOUT_MS = Number("__COLLECTOR_STEP_TIMEOUT_MS__");
const MOVE_ACTIONS = 4;
const ACTION_DIM = 10;
const CRITICAL_HP_RATIO = Number("__COLLECTOR_CRITICAL_HP_RATIO__");
const HALF_HP_RATIO = Number("__COLLECTOR_HALF_HP_RATIO__");
const REWARD_SWITCH_PENALTY = Number("__COLLECTOR_REWARD_SWITCH_PENALTY__");
const REWARD_STEP_PENALTY = Number("__COLLECTOR_REWARD_STEP_PENALTY__");
const REWARD_CONSECUTIVE_SWITCH_PENALTY = Number("__COLLECTOR_REWARD_CONSECUTIVE_SWITCH_PENALTY__");
const REWARD_DIRECT_BACKSWITCH_PENALTY = Number("__COLLECTOR_REWARD_DIRECT_BACKSWITCH_PENALTY__");
const REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE = Number("__COLLECTOR_REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE__");
const REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE = Number("__COLLECTOR_REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE__");
const REWARD_PLAYER_TEAM_HP_LOSS_SCALE = Number("__COLLECTOR_REWARD_PLAYER_TEAM_HP_LOSS_SCALE__");
const REWARD_ENEMY_FAINT_BONUS = Number("__COLLECTOR_REWARD_ENEMY_FAINT_BONUS__");
const REWARD_PLAYER_FAINT_PENALTY = Number("__COLLECTOR_REWARD_PLAYER_FAINT_PENALTY__");
const REWARD_ENEMY_TEAM_DEFEAT_BONUS = Number("__COLLECTOR_REWARD_ENEMY_TEAM_DEFEAT_BONUS__");
const REWARD_PLAYER_TEAM_DEFEAT_PENALTY = Number("__COLLECTOR_REWARD_PLAYER_TEAM_DEFEAT_PENALTY__");
const REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS = Number("__COLLECTOR_REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS__");
const REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE = Number("__COLLECTOR_REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE__");
const PLANNED_EPISODES = Number("__COLLECTOR_PLANNED_EPISODES__");
const POLICY_JSON = "__COLLECTOR_POLICY_JSON__";
const POLICY = JSON.parse(POLICY_JSON);
const persistentExternalPolicyWorkers = new Map<string, any>();

function isHardTerminalPhase(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("TitlePhase");
}

export function hasRemainingPlayerTeam(game: GameManager): boolean {
  return game.scene.getPlayerParty().some(member => !member.isFainted() && member.isAllowedInBattle());
}

export function isVictorySafe(game: GameManager): boolean {
  const battle = game.scene.currentBattle;
  if (!battle || !Array.isArray(battle.enemyParty)) {
    return false;
  }
  return battle.enemyParty.every(pokemon => pokemon.isFainted());
}

export function currentPhaseNameSafe(game: GameManager): string {
  return game.scene.phaseManager.getCurrentPhase()?.constructor?.name ?? "UnknownPhase";
}

export function currentUiModeNameSafe(game: GameManager): string {
  const uiMode = game.scene.ui?.getMode?.();
  if (typeof uiMode === "number" && UiMode[uiMode]) {
    return String(UiMode[uiMode]);
  }
  return "UnknownUiMode";
}

export function describePartyForDiagnostics(game: GameManager): string {
  return game.scene
    .getPlayerParty()
    .map((member, index) => {
      if (!member) {
        return `${index}:empty`;
      }
      return [
        `${index}:${member.name ?? member.species?.name ?? "unknown"}`,
        `hp=${member.hp}/${typeof member.getMaxHp === "function" ? member.getMaxHp() : "?"}`,
        `fainted=${member.isFainted?.() === true}`,
        `onField=${member.isOnField?.() === true}`,
        `allowed=${member.isAllowedInBattle?.() === true}`,
      ].join(",");
    })
    .join(" | ");
}

export function describePartyUiHandlerForDiagnostics(game: GameManager): string {
  // Immer der Party-Handler, auch wenn gerade ein anderer Modus aktiv ist: sein liegengebliebener Zustand
  // (optionsMode, options) ist bei Wechsel-Haengern die relevante Information (Signatur E).
  const handler = (game.scene.ui?.handlers?.[UiMode.PARTY] ?? game.scene.ui?.getHandler?.()) as any;
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

export function describePromptQueueForDiagnostics(game: GameManager): string {
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

// Lesbarer Kampfkontext fuer Policies, die wie ein Spieler entscheiden (z. B. eine Claude-Session pro Kampf).
// Enthaelt nur, was ein Spieler auf dem Bildschirm sieht: eigenes Team komplett, vom Gegner nur Spezies, Level,
// Typen, HP in Prozent, Status und Werteveraenderungen (keine Attacken, keine Faehigkeit, kein Team).
// Wird nur bei policy.include_battle_context an den externen Worker geschickt, nie in die Transitions geschrieben.
const BATTLE_STAT_NAMES = ["ATK", "DEF", "SPATK", "SPDEF", "SPD", "ACC", "EVA"];

function contextSafe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function describeTypes(pokemon: any): string[] {
  return contextSafe(() => (pokemon.getTypes() as number[]).map(type => PokemonType[type] ?? String(type)), []);
}

function describeStatus(pokemon: any): string | null {
  const effect = pokemon?.status?.effect;
  return effect == null || effect === StatusEffect.NONE ? null : (StatusEffect[effect] ?? String(effect));
}

function describeStatStages(pokemon: any): Record<string, number> {
  const stages = contextSafe(() => pokemon.getStatStages() as number[], []);
  const result: Record<string, number> = {};
  stages.forEach((value, index) => {
    if (value !== 0) {
      result[BATTLE_STAT_NAMES[index] ?? String(index)] = value;
    }
  });
  return result;
}

function describeSpecies(pokemon: any): string {
  return contextSafe(() => pokemon.species.getName(pokemon.formIndex), pokemon?.name ?? "unknown");
}

export function buildBattleContext(game: GameManager, messageCursor: { index: number }): Record<string, unknown> {
  const battle = game.scene.currentBattle as any;
  const party = game.scene.getPlayerParty();
  const enemy = game.scene.getEnemyPokemon() as any;
  const arena = game.scene.arena as any;
  const logs: string[] = Array.isArray((game as any).textInterceptor?.logs) ? (game as any).textInterceptor.logs : [];
  const newMessages = logs
    .slice(messageCursor.index)
    .map(text => String(text).replace(/@\w{.*?}/g, "").replace(/\$/g, " ").replace(/\s+/g, " ").trim())
    // Unuebersetzte i18n-Schluessel (z. B. "dialogue:rivalFemale.encounter.1") sieht kein Spieler.
    .filter(text => text.length > 0 && !/^[a-zA-Z]+:[\w.]+$/.test(text));
  messageCursor.index = logs.length;

  const enemyParty = Array.isArray(battle?.enemyParty) ? battle.enemyParty : [];
  return {
    wave: battle?.waveIndex ?? null,
    turn: battle?.turn ?? null,
    battle_type: battle?.trainer ? "trainer" : "wild",
    trainer: battle?.trainer ? contextSafe(() => battle.trainer.getName(), "trainer") : null,
    enemy_pokemon_remaining: battle?.trainer ? enemyParty.filter((member: any) => !member.isFainted()).length : null,
    weather: arena?.weather ? (WeatherType[arena.weather.weatherType] ?? null) : null,
    terrain: arena?.terrain ? (TerrainType[arena.terrain.terrainType] ?? null) : null,
    new_messages: newMessages,
    player_party: party.map((member: any, slot: number) => ({
      slot,
      species: describeSpecies(member),
      level: member.level,
      hp: member.hp,
      max_hp: contextSafe(() => member.getMaxHp(), null),
      status: describeStatus(member),
      fainted: member.isFainted(),
      active: member.isOnField(),
      types: describeTypes(member),
      ability: contextSafe(() => member.getAbility().name, null),
      stat_stages: member.isOnField() ? describeStatStages(member) : {},
      moves: contextSafe(() => member.getMoveset().filter((move: any) => move != null).map((move: any, moveSlot: number) => {
        const data = move.getMove();
        const ppMax = move.getMovePp();
        return {
          slot: moveSlot,
          name: data.name,
          type: PokemonType[data.type] ?? String(data.type),
          category: MoveCategory[data.category] ?? String(data.category),
          power: data.power > 0 ? data.power : null,
          accuracy: data.accuracy > 0 ? data.accuracy : null,
          pp: `${Math.max(0, ppMax - (move.ppUsed ?? 0))}/${ppMax}`,
        };
      }), []),
    })),
    enemy_active: enemy
      ? {
        species: describeSpecies(enemy),
        level: enemy.level,
        hp_percent: Math.round((enemy.hp / Math.max(1, enemy.getMaxHp())) * 100),
        status: describeStatus(enemy),
        types: describeTypes(enemy),
        stat_stages: describeStatStages(enemy),
        boss: contextSafe(() => enemy.isBoss(), false),
      }
      : null,
  };
}

export function isCollectorEpisodeTerminalPhase(game: GameManager): boolean {
  return isHardTerminalPhase(game)
    || game.isCurrentPhase("BattleEndPhase")
    || game.isCurrentPhase("SelectModifierPhase")
    || (TERMINAL_ON_EGG_LAPSE && game.isCurrentPhase("EggLapsePhase"));
}

// Zwangswechsel und Wechselangebot laufen ueber die Harness, damit der Entscheidungs-Hook (switch-decision.ts) auch
// hier greift: ohne registrierten Provider erster gueltiger Slot bzw. Angebot ablehnen, mit Provider die Policy.
export { clearStalePromptsForForcedSwitch, resolveForcedSwitchIfNeeded, resolveOptionalCheckSwitchIfNeeded };
export { setSwitchDecisionProvider };

const TERMINAL_PHASE_NAMES = [
  "GameOverPhase",
  "PostGameOverPhase",
  "TitlePhase",
  "BattleEndPhase",
  "SelectModifierPhase",
  "EggLapsePhase",
];

export function hasLoggedTerminalPhaseSince(game: GameManager, fromIndex: number): boolean {
  const phaseLog = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log : [];
  for (let idx = Math.max(0, fromIndex); idx < phaseLog.length; idx += 1) {
    if (TERMINAL_PHASE_NAMES.includes(String(phaseLog[idx]))) {
      return true;
    }
  }
  return false;
}

export function requiresTerminalDrain(game: GameManager): boolean {
  return game.isCurrentPhase("GameOverPhase") || game.isCurrentPhase("PostGameOverPhase");
}

export function selectMoveByIndex(game: GameManager, actionIndex: number): void {
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

// Private Felder des Party-Handlers, die der Collector lesen muss. PartyUiHandler.clear() setzt optionsMode und
// options nicht zurueck; ein offenes Options-Menue ueberlebt deshalb den Moduswechsel und den naechsten Kampf auf
// derselben Szene (siehe docs/pokerogue-headless-test-harness-mechanics.md, Signatur E).
type PartyUiHandlerInternals = { optionsMode: boolean; options: number[]; cursor: number };

function partyInternals(handler: PartyUiHandler): PartyUiHandlerInternals {
  return handler as unknown as PartyUiHandlerInternals;
}

// Nur fuer den Replay-Test: oeffnet im Party-Menue die Optionen fuer Slot 1 und verlaesst das Menue, ohne sie zu
// schliessen. Gibt zurueck, ob danach ein offenes Options-Menue im Handler zurueckbleibt.
export async function leavePartyOptionsOpenForTest(game: GameManager): Promise<boolean> {
  const ui = game.scene.ui;
  await ui.setMode(UiMode.PARTY, PartyUiMode.SWITCH, 0);
  const handler = ui.getHandler() as PartyUiHandler;
  handler.setCursor(1);
  handler.processInput(Button.ACTION);
  await ui.setMode(UiMode.COMMAND, 0);
  return partyInternals(handler).optionsMode === true;
}

// Wechsel ueber sendOutFromPartyUi aus dem Harness statt GameManager.doSwitchPokemon: dessen blinde ACTION-Folge
// oeffnet bei liegengebliebenen Party-Optionen die Uebersicht (SUMMARY, Signatur E).
export function selectSwitchByPartyIndex(game: GameManager, partyIndex: number): void {
  game.onNextPrompt("CommandPhase", UiMode.COMMAND, () => {
    const commandHandler = game.scene.ui.getHandler() as CommandUiHandler;
    commandHandler.setCursor(2);
    commandHandler.processInput(Button.ACTION);
  });
  game.onNextPrompt("CommandPhase", UiMode.PARTY, () => {
    sendOutFromPartyUi(game, partyIndex);
  });
}

export function executeAction(game: GameManager, action: number): void {
  if (action < MOVE_ACTIONS) {
    selectMoveByIndex(game, action);
    return;
  }
  const switchIndex = action - MOVE_ACTIONS;
  selectSwitchByPartyIndex(game, switchIndex);
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
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

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForPromiseOrTerminal(
  game: GameManager,
  promise: Promise<unknown>,
  timeoutMs: number,
): Promise<"ok" | "terminal" | "timeout"> {
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
    // Level-Up mit neuer Attacke bei vollem Moveset fragt per CONFIRM/SUMMARY nach; ohne Antwort haengt LearnMovePhase.
    if (resolveLearnMoveIfNeeded(game)) {
      console.log(`[collector-learn-move] ui_mode=${currentUiModeNameSafe(game)}`);
    }
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

export async function drainTerminalPhase(game: GameManager, timeoutMs: number): Promise<"settled" | "timeout"> {
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

export async function waitForCommandOrTerminalAfterForcedSwitch(
  game: GameManager,
  timeoutMs: number,
): Promise<"ok" | "terminal" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    resolveOptionalCheckSwitchIfNeeded(game);
    // Level-Up mit neuer Attacke bei vollem Moveset fragt per CONFIRM/SUMMARY nach; ohne Antwort haengt LearnMovePhase.
    if (resolveLearnMoveIfNeeded(game)) {
      console.log(`[collector-learn-move] ui_mode=${currentUiModeNameSafe(game)}`);
    }
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

export function getDefaultStepTimeoutMs(): number {
  return STEP_TIMEOUT_MS;
}

export function getPlayerTeamHpRatio(game: GameManager): number {
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

export function getEnemyTeamHpRatio(game: GameManager): number {
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

export function countAlivePlayerTeamMembers(game: GameManager): number {
  return game.scene
    .getPlayerParty()
    .filter(member => !!member && !member.isFainted() && member.isAllowedInBattle())
    .length;
}

export function findActivePartySlotIndex(observation: { party_slots?: Array<{ active?: number }> }): number {
  const partySlots = Array.isArray(observation?.party_slots) ? observation.party_slots : [];
  return partySlots.findIndex(slot => slot?.active === 1);
}

export function deriveTerminalNextState<T extends { action_mask: number[] }>(
  state: T & { player_hp_ratio: number; enemy_hp_ratio: number; player_hp_bucket: number; enemy_hp_bucket: number },
  enemyTeamDefeated: boolean,
  playerTeamDefeated: boolean,
): T {
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

export function countFaintedPlayerPokemon(game: GameManager): number {
  return game.scene.getPlayerParty().filter(member => !!member && member.isFainted()).length;
}

export function countFaintedEnemyPokemon(game: GameManager): number {
  const enemyParty = Array.isArray(game.scene.currentBattle?.enemyParty) ? game.scene.currentBattle.enemyParty : [];
  return enemyParty.filter(member => !!member && member.isFainted()).length;
}

/**
 * Reward einer Entscheidung bis zur naechsten (combat-v4, docs/combat-state-v4.md Abschnitt 3):
 * - Schritt-Strafe und Grund-Wechselstrafe nur fuer command (decision_kind 0); ein Wechselangebot kostet keinen Zug.
 * - Ketten- und Rueckwechsel-Strafe fuer freiwillige Wechsel (command und check_switch); forced_switch ist strafenfrei.
 * - "bleiben" beim Wechselangebot (aktiver Slot) ist kein Wechsel.
 * - K.O.-Bonus/-Strafe je neu besiegtem Pokemon im Fenster (Zaehler statt aktiver Pokemon, damit K.O.s mitten im Kampf
 *   nicht durch den Nachfolger auf dem Feld verdeckt werden).
 * Die Verlaufswerte (lastActionWasSwitch, consecutiveSwitchCount, lastSwitchOriginPartyIndex) sind die vor der
 * Entscheidung und stehen damit auch im State der Entscheidung.
 */
export function computeTransitionReward(input: {
  decisionKind: number;
  action: number;
  activePartyIndexBeforeAction: number;
  lastActionWasSwitch: boolean;
  consecutiveSwitchCount: number;
  lastSwitchOriginPartyIndex: number | null;
  enemyTeamHpBeforeAction: number;
  nextEnemyTeamHp: number;
  playerTeamHpBeforeAction: number;
  nextPlayerTeamHp: number;
  enemyFaints: number;
  playerFaints: number;
  enemyTeamDefeated: boolean;
  playerTeamDefeated: boolean;
  alivePlayerTeamMembers: number;
}): number {
  const isCommand = input.decisionKind === 0;
  const switchTargetIndex = input.action - MOVE_ACTIONS;
  const isVoluntarySwitch = input.action >= MOVE_ACTIONS
    && input.decisionKind !== 1
    && !(input.decisionKind === 2 && switchTargetIndex === input.activePartyIndexBeforeAction);

  let reward = isCommand ? REWARD_STEP_PENALTY : 0;
  const enemyTeamHpDamage = Math.max(0, input.enemyTeamHpBeforeAction - input.nextEnemyTeamHp);
  const playerTeamHpLoss = Math.max(0, input.playerTeamHpBeforeAction - input.nextPlayerTeamHp);
  reward += enemyTeamHpDamage * REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE;
  reward += playerTeamHpLoss * REWARD_PLAYER_TEAM_HP_LOSS_SCALE;

  if (isVoluntarySwitch) {
    if (isCommand) {
      reward += REWARD_SWITCH_PENALTY;
    }
    if (input.lastActionWasSwitch) {
      reward += REWARD_CONSECUTIVE_SWITCH_PENALTY;
      reward += input.consecutiveSwitchCount * REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE;
    }
    if (input.lastSwitchOriginPartyIndex != null && switchTargetIndex === input.lastSwitchOriginPartyIndex) {
      reward += REWARD_DIRECT_BACKSWITCH_PENALTY;
    }
  }

  reward += Math.max(0, input.enemyFaints) * REWARD_ENEMY_FAINT_BONUS;
  reward += Math.max(0, input.playerFaints) * REWARD_PLAYER_FAINT_PENALTY;
  if (input.enemyTeamDefeated) {
    reward += REWARD_ENEMY_TEAM_DEFEAT_BONUS;
    reward += input.alivePlayerTeamMembers * REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS;
    reward += input.nextPlayerTeamHp * REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE;
  }
  if (input.playerTeamDefeated) reward += REWARD_PLAYER_TEAM_DEFEAT_PENALTY;

  return reward;
}

export function deriveTerminalOutcome(input: {
  enemyTeamDefeated: boolean;
  playerTeamDefeated: boolean;
  timeoutTruncated: boolean;
  maxStepsTruncated: boolean;
  battleEnded?: boolean;
}): "win" | "loss" | "timeout" | "truncated" | "battle_ended" | null {
  return input.enemyTeamDefeated
    ? "win"
    : input.playerTeamDefeated
    ? "loss"
    : input.timeoutTruncated
    ? "timeout"
    : input.maxStepsTruncated
    ? "truncated"
    : input.battleEnded
    ? "battle_ended"
    : null;
}

// Die Observation kommt aus dem gemeinsamen Builder (src/main/ts/lib/combat-observation.ts), den auch der strategische
// Collector und die JS-Bridge des Live-Bots verwenden. Der Runner kopiert ihn beim Materialisieren neben diesen Helper.
export {
  accuracyBucket,
  actsFirstIfUsed,
  bucketByThresholds,
  countBucket,
  damageClassBucket,
  damageRatioBucket,
  effectivenessBucket,
  estimateDamageRatio,
  getBestKnownEnemyPriority,
  getEffectiveSpeed,
  getHpRatio,
  hpBucket,
  hpDiffBucket,
  koTurnsBucket,
  levelGapBucket,
  moveKindBucket,
  powerBucket,
  priorityBucket,
  speedOrderAdvantage,
  usesBestOffenseStat,
};
export { canBuildCombatObservation, contextFromHistory, emptyCombatDecisionHistory, updateCombatDecisionHistory };
export type { CombatDecisionHistory, CombatObservation, DecisionKind };

function inferScenarioTrainerBattle(scenario: any): boolean {
  const battleType = typeof scenario?.battle_type === "string"
    ? scenario.battle_type.toLowerCase()
    : "";
  if (battleType === "trainer") {
    return true;
  }

  return scenario?.trainer != null;
}

let enumParityChecked = false;

/** combat-v4-Observation; `history` und `decisionKind` fuehrt der Runner (siehe updateCombatDecisionHistory). */
export function buildObservation(
  game: GameManager,
  scenario: any,
  history: CombatDecisionHistory = emptyCombatDecisionHistory(),
  decisionKind: DecisionKind = 0,
): CombatObservation {
  if (!enumParityChecked) {
    assertCombatObservationEnumParity(TerrainType as unknown as Record<string, string | number>);
    enumParityChecked = true;
  }
  return buildCombatObservation(game.scene, contextFromHistory(history, decisionKind, inferScenarioTrainerBattle(scenario)));
}

export function enemyHasKnownPriorityThreat(enemy: Parameters<typeof getBestKnownEnemyPriority>[0]): boolean {
  return getBestKnownEnemyPriority(enemy) > 0;
}

export function setPokemonHpRatio(pokemon: any, ratio: number): void {
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

export function setPokemonHpAbsolute(pokemon: any, hp: number): void {
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

export function hashString(value: string): number {
  let hash = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    hash = ((hash * 31) + value.charCodeAt(idx)) >>> 0;
  }
  return hash;
}

export function pickDeterministicBenchIndex(game: GameManager, token: string): number | null {
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

export function applyStateVariant(
  game: GameManager,
  variantId: string | null,
  episodeToken: string,
): void {
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

function mapTrainerTypeName(value: unknown): TrainerType | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const trainerType = TrainerType[value as keyof typeof TrainerType];
  return Number.isInteger(trainerType) ? trainerType as TrainerType : null;
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

export function patchPokemonFromScenario(pokemon: any, member: any, player: boolean): void {
  if (!pokemon || !member) {
    return;
  }

  pokemon.id = Number(member.id);
  pokemon.name = typeof member.name === "string" ? member.name : pokemon.name;
  // Immer die Spezies, nie ein Form-Objekt: getPokemonSpeciesForm(id, 0) liefert bei Spezies mit Formen
  // (z. B. Pichu) ein PokemonSpeciesForm ohne getName(); die Form steuert pokemon.formIndex.
  pokemon.species = speciesDataRegistry.getSpecies(Number(member.species_id));
  pokemon.formIndex = Number.isInteger(member.form_index) ? Number(member.form_index) : 0;
  pokemon.level = Number(member.level);
  // Szenarien speichern das Geschlecht als Enum-Namen ("MALE"); das Spiel erwartet den Enum-Wert.
  const genderValue = typeof member.gender === "string"
    ? Gender[member.gender as keyof typeof Gender]
    : member.gender;
  if (Number.isInteger(genderValue)) {
    pokemon.gender = genderValue as Gender;
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

export function applyScenarioMaterializedState(game: GameManager, scenario: any): void {
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

export function buildEnemyPokemonFromScenario(game: GameManager, member: any) {
  const species = speciesDataRegistry.getSpecies(Number(member.species_id));
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

export function prepareScenarioBattleBeforeEncounter(game: GameManager, scenario: any): void {
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

/**
 * Wildkaempfe ab Wave 2 bieten im Kampfstil SWITCH vor dem ersten Zug einen kostenlosen Wechsel an (CheckSwitchPhase,
 * nur aus EncounterPhase). Die Szenarien sind alle SET; mit `checkSwitchDecisions` stellt der Collector solche Kaempfe
 * auf SWITCH um, damit das Angebot als Entscheidung (decision_kind 2) in den Daten vorkommt.
 */
export function scenarioOffersCheckSwitch(scenario: any): boolean {
  return mapBattleTypeName(getScenarioBattleTypeName(scenario)) === BattleType.WILD
    && getScenarioWaveIndex(scenario) > 1
    && scenario?.is_double_fight !== true
    && Array.isArray(scenario?.player_team)
    && scenario.player_team.length > 1;
}

export function applyScenarioOverrides(
  game: GameManager,
  scenario: any,
  seedOverride: string | null,
  options: { checkSwitchDecisions?: boolean } = {},
): void {
  const effectiveSeed = seedOverride ?? scenario.seed ?? null;
  const waveIndex = getScenarioWaveIndex(scenario);
  const battleStyle = mapBattleStyleName(scenario.battle_style);
  const battleType = mapBattleTypeName(getScenarioBattleTypeName(scenario));
  const trainerType = battleType === BattleType.TRAINER ? mapTrainerTypeName(scenario.trainer?.trainer_type) : null;

  if (effectiveSeed) {
    game.override.seed(effectiveSeed);
    requestedSeeds.set(game, effectiveSeed);
  } else {
    requestedSeeds.delete(game);
  }
  if (Number.isFinite(waveIndex)) {
    game.override.startingWave(waveIndex);
  }
  // `override.battleStyle` steuert seit v1.12 Einzel- vs. Doppelkampf ("single"/"double"). Ein ungueltiger
  // Wert faellt dort in den default-Zweig, und das Spiel wuerfelt Doppelkaempfe per Seed selbst aus.
  game.override.battleStyle(scenario.is_double_fight === true ? "double" : "single");
  // Die Spieleinstellung SET/SWITCH (Wechsel-Angebot nach KO) ist davon unabhaengig.
  if (battleStyle != null) {
    game.scene.battleStyle = battleStyle;
  }
  if (options.checkSwitchDecisions === true && scenarioOffersCheckSwitch(scenario)) {
    game.scene.battleStyle = BattleStyle.SWITCH;
  }
  game.override.battleType(battleType);
  if (trainerType != null) {
    game.override.randomTrainer({ trainerType });
  }
}

/**
 * `generateStarters` (pokerogue/test/utils/game-manager-utils.ts) setzt `scene.seed` hart auf "test", nachdem
 * `applyScenarioOverrides` den Szenario-Seed per `game.override.seed()` gesetzt hat. Ohne Wiederherstellung spielt jedes
 * Szenario mit Seed "test" (Befund 2026-10-15, docs/pokerogue-headless-test-harness-mechanics.md 3.17).
 * Wiederhergestellt wird nur ein ausdruecklich gesetzter Seed (Config `seeds` oder `scenario.seed`); ohne Seed bleibt
 * es beim deterministischen "test", auf dem die bisherigen Combat-Daten und -Benchmarks beruhen.
 * `POKEROGUE_COMBAT_KEEP_HARNESS_SEED=1` behaelt auch bei gesetztem Seed das alte Verhalten, damit die Replays frueherer
 * Timeouts (combat-collector-replays.test.ts) exakt die damals aufgezeichnete Lage nachstellen.
 */
const KEEP_HARNESS_SEED = process.env.POKEROGUE_COMBAT_KEEP_HARNESS_SEED === "1";
/** Von applyScenarioOverrides gesetzter Seed je GameManager. */
const requestedSeeds = new WeakMap<GameManager, string>();

export async function startScenarioBattle(game: GameManager, scenario: any, teamSpecies: number[]): Promise<void> {
  const restoreSeed = KEEP_HARNESS_SEED ? null : (requestedSeeds.has(game) ? game.scene.seed : null);
  await game.runToTitle();

  game.onNextPrompt("TitlePhase", UiMode.TITLE, () => {
    game.scene.gameMode = getGameMode(GameModes.CLASSIC);
    const starters = generateStarters(game.scene, teamSpecies as any);
    if (restoreSeed !== null) {
      // Nur das Feld zuruecksetzen: die von setSeed abgeleiteten Werte (waveCycleOffset, offsetGym) stammen noch vom
      // Szenario-Seed.
      game.scene.seed = restoreSeed;
    }
    const selectStarterPhase = new SelectStarterPhase();
    game.scene.phaseManager.pushPhase(new EncounterPhase(false));
    selectStarterPhase.initBattle(starters);
  });

  await game.phaseInterceptor.to("EncounterPhase", false);
  if (restoreSeed !== null && game.scene.seed !== restoreSeed) {
    throw new Error(`seed_not_applied:${game.scene.seed}`);
  }

  prepareScenarioBattleBeforeEncounter(game, scenario);
  await advanceToFirstCommandPhase(game);
}

/**
 * Vom Kampfbeginn bis zur ersten CommandPhase. Bedient dabei das Wechselangebot (CheckSwitchPhase, nur im Kampfstil
 * SWITCH) und den daraus folgenden SwitchPhase ueber die Harness, also mit dem Entscheidungs-Hook des Runners.
 * Ohne Angebot ist das gleichwertig zu `phaseInterceptor.to("CommandPhase")`.
 */
async function advanceToFirstCommandPhase(game: GameManager): Promise<void> {
  let reached = false;
  let failure: unknown = null;
  const pump = withTimeout(game.phaseInterceptor.to("CommandPhase"), STEP_TIMEOUT_MS, "scenario start command phase")
    .then(() => {
      reached = true;
    })
    .catch(error => {
      failure = error;
    });
  while (!reached && failure == null) {
    resolveOptionalCheckSwitchIfNeeded(game);
    resolveForcedSwitchIfNeeded(game);
    await sleep(25);
  }
  await pump;
  if (failure != null) {
    throw failure;
  }
}

function sampleUniformAction(valid: number[]): number {
  return valid[Math.floor(Math.random() * valid.length)];
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

export function cleanupPersistentExternalPolicyWorkers(): void {
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

async function runPersistentExternalPolicy(
  policyConfig: any,
  state: any,
  actionMask: number[],
  extras: Record<string, unknown> = {},
): Promise<number> {
  const worker = getOrStartPersistentExternalPolicyWorker(policyConfig);
  const timeoutMs = Number.isFinite(policyConfig?.timeout_ms) && policyConfig.timeout_ms > 0
    ? policyConfig.timeout_ms
    : 5000;
  const payload = JSON.stringify({ ...extras, state, action_mask: actionMask }) + "\n";

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

async function runExternalPolicy(
  policyConfig: any,
  state: any,
  actionMask: number[],
  extras: Record<string, unknown> = {},
): Promise<number> {
  if (policyConfig?.persistent === true) {
    return runPersistentExternalPolicy(policyConfig, state, actionMask, extras);
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

export async function selectActionFromMask(
  state: any,
  actionMask: number[],
  globalEpisodeIndex: number,
  // Zusatzfelder fuer externe Worker (episode_id, step_index, battle_context); der DQN-Worker ignoriert sie.
  policyExtras: Record<string, unknown> = {},
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
    const action = await runExternalPolicy(POLICY, state, actionMask, policyExtras);
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
