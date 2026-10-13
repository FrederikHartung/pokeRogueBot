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
import { Stat } from "#enums/stat";
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
import { resolveLearnMoveIfNeeded } from "#test/porubot/harness/battle-command-advance";
import { PokemonType } from "#enums/pokemon-type";
import { WeatherType } from "#enums/weather-type";
import { TerrainType } from "#data/terrain";
import type { CommandUiHandler } from "#ui/command-ui-handler";
import { PartyOption, type PartyUiHandler } from "#ui/party-ui-handler";

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

export function clearStalePromptsForForcedSwitch(game: GameManager): void {
  const interceptor = game.phaseInterceptor as any;
  if (!Array.isArray(interceptor?.prompts) || interceptor.prompts.length === 0) {
    return;
  }

  while (interceptor.prompts.length > 0 && interceptor.prompts[0]?.phaseTarget === "CheckSwitchPhase") {
    interceptor.prompts.shift();
  }
}

export function resolveForcedSwitchIfNeeded(game: GameManager): "not_switch_phase" | "selected" | "no_candidate" {
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
      sendOutFromPartyUi(game, nextIndex);
    } else if (battle?.__collectorForcedSwitchQueued !== nextIndex) {
      game.onNextPrompt("SwitchPhase", UiMode.PARTY, () => {
        sendOutFromPartyUi(game, nextIndex);
      });
      if (battle) {
        battle.__collectorForcedSwitchQueued = nextIndex;
      }
    }
    return "selected";
  }
  return "no_candidate";
}

export function resolveOptionalCheckSwitchIfNeeded(game: GameManager): "not_check_switch" | "skipped" {
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

// Ersetzt GameManager.doSwitchPokemon/doSelectPartyPokemon: die druecken im Party-Menue blind zweimal ACTION und
// nehmen an, dass die oberste Option "Einwechseln" ist. Mit einem liegengebliebenen Options-Menue verschiebt
// setCursor() aber den Options-Cursor, und das zweite ACTION oeffnet die Uebersicht (SUMMARY, Signatur E).
// Hier: offenes Options-Menue schliessen, Slot setzen und pruefen, SEND_OUT gezielt anwaehlen.
export function sendOutFromPartyUi(game: GameManager, partyIndex: number): boolean {
  const handler = game.scene.ui.getHandler() as PartyUiHandler;
  const internals = partyInternals(handler);
  const target = game.scene.getPlayerParty()[partyIndex];
  if (!target || target.isFainted() || target.isOnField()) {
    console.log(`[collector-party-select] slot=${partyIndex} not selectable (fainted, on field or missing)`);
    return false;
  }
  if (internals.optionsMode) {
    console.log(`[collector-party-select] cleared stale party options (options=${internals.options.length})`);
    handler.clearOptions();
  }
  handler.setCursor(partyIndex);
  for (let attempts = 0; attempts < 8 && internals.cursor !== partyIndex; attempts += 1) {
    handler.processInput(internals.cursor < partyIndex ? Button.DOWN : Button.UP);
  }
  if (internals.cursor !== partyIndex) {
    console.log(`[collector-party-select] cursor stuck at ${internals.cursor}, wanted slot ${partyIndex}`);
    return false;
  }
  handler.processInput(Button.ACTION);
  const sendOutIndex = internals.optionsMode ? internals.options.indexOf(PartyOption.SEND_OUT) : -1;
  if (sendOutIndex < 0) {
    console.log(`[collector-party-select] no SEND_OUT option for slot ${partyIndex} (optionsMode=${internals.optionsMode})`);
    if (internals.optionsMode) {
      handler.clearOptions();
    }
    return false;
  }
  handler.setCursor(sendOutIndex);
  handler.processInput(Button.ACTION);
  return true;
}

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

export function findActivePartySlotIndex(observation: any): number {
  const partySlots = Array.isArray(observation?.party_slots) ? observation.party_slots : [];
  for (let idx = 0; idx < partySlots.length; idx += 1) {
    if (partySlots[idx]?.active === 1) {
      return idx;
    }
  }
  return -1;
}

export function deriveTerminalNextState(state: any, enemyTeamDefeated: boolean, playerTeamDefeated: boolean) {
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

export function computeTransitionReward(input: {
  action: number;
  previousAction: number | null;
  consecutiveSwitchCount: number;
  lastSwitchOriginPartyIndex: number | null;
  enemyTeamHpBeforeAction: number;
  nextEnemyTeamHp: number;
  playerTeamHpBeforeAction: number;
  nextPlayerTeamHp: number;
  enemyFainted: boolean;
  playerFainted: boolean;
  enemyTeamDefeated: boolean;
  playerTeamDefeated: boolean;
  alivePlayerTeamMembers: number;
}): number {
  let reward = REWARD_STEP_PENALTY;
  const enemyTeamHpDamage = Math.max(0, input.enemyTeamHpBeforeAction - input.nextEnemyTeamHp);
  const playerTeamHpLoss = Math.max(0, input.playerTeamHpBeforeAction - input.nextPlayerTeamHp);
  reward += enemyTeamHpDamage * REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE;
  reward += playerTeamHpLoss * REWARD_PLAYER_TEAM_HP_LOSS_SCALE;

  if (input.action >= MOVE_ACTIONS) {
    const switchTargetIndex = input.action - MOVE_ACTIONS;
    reward += REWARD_SWITCH_PENALTY;
    if (input.previousAction != null && input.previousAction >= MOVE_ACTIONS) {
      reward += REWARD_CONSECUTIVE_SWITCH_PENALTY;
      reward += input.consecutiveSwitchCount * REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE;
    }
    if (input.lastSwitchOriginPartyIndex != null && switchTargetIndex === input.lastSwitchOriginPartyIndex) {
      reward += REWARD_DIRECT_BACKSWITCH_PENALTY;
    }
  }

  if (input.enemyFainted) reward += REWARD_ENEMY_FAINT_BONUS;
  if (input.playerFainted) reward += REWARD_PLAYER_FAINT_PENALTY;
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
  done: boolean;
  stepIndex: number;
  maxStepsPerEpisode: number;
}): "win" | "loss" | "timeout" | "truncated" | null {
  const maxStepsTruncated = !input.enemyTeamDefeated
    && !input.playerTeamDefeated
    && !input.timeoutTruncated
    && input.done
    && input.stepIndex === input.maxStepsPerEpisode - 1;

  return input.enemyTeamDefeated
    ? "win"
    : input.playerTeamDefeated
    ? "loss"
    : input.timeoutTruncated
    ? "timeout"
    : maxStepsTruncated
    ? "truncated"
    : null;
}

export function getHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

export function bucketByThresholds(value: number, thresholds: number[]): number {
  for (let idx = 0; idx < thresholds.length; idx += 1) {
    if (value <= thresholds[idx]) {
      return idx;
    }
  }
  return thresholds.length;
}

export function hpBucket(hpRatio: number): number {
  return bucketByThresholds(hpRatio, [0.05, 0.2, 0.4, 0.6, 0.8]);
}

export function hpDiffBucket(diff: number): number {
  return bucketByThresholds(diff, [-0.6, -0.25, -0.1, 0.1, 0.25, 0.6]);
}

export function levelGapBucket(levelGap: number): number {
  return bucketByThresholds(levelGap, [-15, -7, -2, 2, 7, 15]);
}

export function powerBucket(power: number): number {
  if (power <= 0) return 0;
  if (power <= 40) return 1;
  if (power <= 70) return 2;
  if (power <= 100) return 3;
  return 4;
}

export function effectivenessBucket(effectiveness: number): number {
  if (effectiveness <= 0) return 0;
  if (effectiveness <= 0.5) return 1;
  if (effectiveness <= 1.0) return 2;
  if (effectiveness <= 2.0) return 3;
  return 4;
}

export function countBucket(value: number): number {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value <= 3) return 2;
  return 3;
}

export function damageClassBucket(category: number): number {
  if (category === MoveCategory.PHYSICAL) return 0;
  if (category === MoveCategory.SPECIAL) return 1;
  return 2;
}

export function moveKindBucket(moveData: any): number {
  const category = moveData?.category;
  const power = Number.isFinite(moveData?.power) ? moveData.power : 0;
  const priority = Number.isFinite(moveData?.priority) ? moveData.priority : 0;
  if (category === MoveCategory.STATUS || power <= 0) return 0;
  if (priority > 0) return 2;
  return 1;
}

export function priorityBucket(priority: number): number {
  if (priority < 0) return 0;
  if (priority === 0) return 1;
  return 2;
}

export function damageRatioBucket(damageRatio: number): number {
  if (damageRatio <= 0) return 0;
  if (damageRatio < 0.25) return 1;
  if (damageRatio < 0.5) return 2;
  if (damageRatio < 1.0) return 3;
  return 4;
}

export function koTurnsBucket(damageRatio: number, targetHpRatio: number): number {
  if (damageRatio <= 0 || targetHpRatio <= 0) return 0;
  if (damageRatio >= targetHpRatio) return 1;
  if ((damageRatio * 2) >= targetHpRatio) return 2;
  return 3;
}

export function accuracyBucket(accuracy: number): number {
  if (accuracy <= 0) return 0;
  if (accuracy < 75) return 1;
  if (accuracy < 90) return 2;
  return 3;
}

export function getEffectiveSpeed(pokemon: any, opponent: any): number {
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

export function speedOrderAdvantage(player: any, enemy: any): number {
  const playerSpeed = getEffectiveSpeed(player, enemy);
  const enemySpeed = getEffectiveSpeed(enemy, player);
  if (playerSpeed > enemySpeed) return 2;
  if (playerSpeed < enemySpeed) return 0;
  return 1;
}

export function getBestKnownEnemyPriority(enemy: any): number {
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

export function enemyHasKnownPriorityThreat(enemy: any): boolean {
  return getBestKnownEnemyPriority(enemy) > 0;
}

export function actsFirstIfUsed(player: any, enemy: any, moveData: any, bestEnemyPriority: number): boolean {
  const priority = Number.isFinite(moveData?.priority) ? moveData.priority : 0;
  if (priority > bestEnemyPriority) return true;
  if (priority < bestEnemyPriority) return false;
  return getEffectiveSpeed(player, enemy) > getEffectiveSpeed(enemy, player);
}

export function estimateDamageRatio(user: any, target: any, moveData: any, effectiveness: number, stab: number): number {
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

export function usesBestOffenseStat(user: any, target: any, moveData: any): boolean {
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

function inferScenarioTrainerBattle(scenario: any): boolean {
  const battleType = typeof scenario?.battle_type === "string"
    ? scenario.battle_type.toLowerCase()
    : "";
  if (battleType === "trainer") {
    return true;
  }

  return scenario?.trainer != null;
}

function isActiveTrappedSafe(pokemon: { isTrapped?: () => boolean } | null | undefined): boolean {
  try {
    return pokemon?.isTrapped?.() === true;
  } catch {
    return false;
  }
}

export function buildObservation(game: GameManager, scenario: any) {
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
    const [usable] = move.isUsable(player, false, true);
    if (!usable) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    return Math.max(best, Number.isFinite(effectiveness) ? effectiveness : 1);
  }, 0);
  const activeBestDamageRatio = moveSet.reduce((best, move) => {
    const moveData = move.getMove();
    const [usable] = move.isUsable(player, false, true);
    if (!usable) return best;
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    const stab = playerTypes.includes(moveData.type) ? 1 : 0;
    return Math.max(best, estimateDamageRatio(player, enemy, moveData, effectiveness, stab));
  }, 0);
  const enemyBestDamageIntoActive = enemy.getMoveset().slice(0, 4).reduce((best, move) => {
    const moveData = move.getMove();
    const [usable] = move.isUsable(enemy, false, true);
    if (!usable) return best;
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
    const [usable] = move.isUsable(player, false, true);
    const available = usable ? 1 : 0;
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
  const activeTrapped = isActiveTrappedSafe(player);
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
        const [usable] = move.isUsable(member, false, true);
        if (!usable) return best;
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
        const [usable] = move.isUsable(enemy, false, true);
        if (!usable) return best;
        const effectiveness = member.getMoveEffectiveness(enemy, moveData, false, true);
        const stab = enemyTypes.includes(moveData.type) ? 1 : 0;
        return Math.max(best, estimateDamageRatio(enemy, member, moveData, effectiveness, stab));
      }, 0);
    const slotSpeedAdvantage = speedOrderAdvantage(member, enemy);
    const survivesOneHit = expectedIncomingDamage < hpRatio;
    const canThreatenKoBucket = koTurnsBucket(bestDamageIntoEnemy, enemyHpRatio);
    // Gefangene Pokemon (Mean Look, Wrap, Shadow Tag, ...) koennen nicht wechseln: das Spiel lehnt den Wechsel ab und
    // bleibt in der CommandPhase. Nur die Maske sperrt den Wechsel; canSwitch bleibt Bank-Feature (State-Schema unveraendert).
    actionMask[MOVE_ACTIONS + slot] = canSwitch && !activeTrapped ? 1 : 0;
    if (canSwitch) {
      const bestEffectiveness = member.getMoveset()
        .slice(0, 4)
        .reduce((best, move) => {
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

export function applyScenarioOverrides(game: GameManager, scenario: any, seedOverride: string | null): void {
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
  // `override.battleStyle` steuert seit v1.12 Einzel- vs. Doppelkampf ("single"/"double"). Ein ungueltiger
  // Wert faellt dort in den default-Zweig, und das Spiel wuerfelt Doppelkaempfe per Seed selbst aus.
  game.override.battleStyle(scenario.is_double_fight === true ? "double" : "single");
  // Die Spieleinstellung SET/SWITCH (Wechsel-Angebot nach KO) ist davon unabhaengig.
  if (battleStyle != null) {
    game.scene.battleStyle = battleStyle;
  }
  game.override.battleType(battleType);
  if (trainerType != null) {
    game.override.randomTrainer({ trainerType });
  }
}

export async function startScenarioBattle(game: GameManager, scenario: any, teamSpecies: number[]): Promise<void> {
  await game.runToTitle();

  game.onNextPrompt("TitlePhase", UiMode.TITLE, () => {
    game.scene.gameMode = getGameMode(GameModes.CLASSIC);
    const starters = generateStarters(game.scene, teamSpecies as any);
    const selectStarterPhase = new SelectStarterPhase();
    game.scene.phaseManager.pushPhase(new EncounterPhase(false));
    selectStarterPhase.initBattle(starters);
  });

  await game.phaseInterceptor.to("EncounterPhase", false);

  prepareScenarioBattleBeforeEncounter(game, scenario);
  await game.phaseInterceptor.to("CommandPhase");
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
