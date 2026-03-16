import fs from "node:fs";
import path from "node:path";
import { AbilityId } from "#enums/ability-id";
import { Button } from "#enums/buttons";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
import { GameManager } from "#test/test-utils/game-manager";
import Phaser from "phaser";
import { afterEach, beforeAll, beforeEach, describe, it } from "vitest";

type DecisionPoint = CombatDecisionPoint | ModifierDecisionPoint;
type ModifierStrategy = "skip";

interface CombatDecisionPoint {
  decision_type: "combat_command";
  wave_index: number;
  turn_index: number;
  is_double_battle: boolean;
  ui_mode: string;
  player: BattlerSnapshot;
  enemy: BattlerSnapshot;
  actions: CombatActionSnapshot[];
  action_mask: number[];
}

interface ModifierDecisionPoint {
  decision_type: "modifier_select";
  wave_index: number;
  ui_mode: string;
  reward_options: ModifierOptionSnapshot[];
  shop_rows: ModifierOptionSnapshot[][];
  actions: ModifierActionSnapshot[];
  action_mask: number[];
  skip_available: boolean;
}

interface BattlerSnapshot {
  species_id: number;
  species_name: string;
  level: number;
  hp_ratio: number;
}

interface CombatActionSnapshot {
  slot: number;
  move_id: number;
  move_name: string;
  pp_left: number;
  pp_max: number;
  power: number;
  accuracy: number;
  enabled: boolean;
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
  shop_row_index?: number;
  shop_column_index?: number;
  modifier_type_id?: string;
  cost: number;
  available: boolean;
  unavailable_reason?: string;
}

const OUTPUT_PATH = __OUTPUT_PATH__;
const SEED = __SEED__;
const MAX_WAVES = __MAX_WAVES__;
const MODIFIER_STRATEGY = __MODIFIER_STRATEGY__ as ModifierStrategy;
const STARTER_SPECIES = [SpeciesId.ABRA, SpeciesId.VOLCARONA];

function getUiModeName(mode: number): string {
  return UiMode[mode] ?? `unknown:${mode}`;
}

function toHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, hp / maxHp));
}

function buildBattlerSnapshot(pokemon: any): BattlerSnapshot {
  return {
    species_id: pokemon.species.speciesId,
    species_name: SpeciesId[pokemon.species.speciesId] ?? String(pokemon.species.speciesId),
    level: pokemon.level,
    hp_ratio: toHpRatio(pokemon.hp, pokemon.getMaxHp()),
  };
}

function buildCombatDecisionPoint(game: GameManager): CombatDecisionPoint {
  const playerPokemon = game.scene.getPlayerPokemon();
  const enemyPokemon = game.scene.getEnemyPokemon();

  if (!playerPokemon || !enemyPokemon) {
    throw new Error("Unable to build combat decision point: missing battlers");
  }

  const actions: CombatActionSnapshot[] = [];
  const actionMask = Array.from({ length: 4 }, () => 0);
  const moveset = playerPokemon.getMoveset();

  for (let slot = 0; slot < Math.min(moveset.length, 4); slot += 1) {
    const move = moveset[slot];
    const ppMax = move.getMovePp();
    const ppLeft = Math.max(0, ppMax - move.ppUsed);
    const moveData = move.getMove();
    const enabled = ppLeft > 0;

    actions.push({
      slot,
      move_id: move.moveId,
      move_name: MoveId[move.moveId] ?? String(move.moveId),
      pp_left: ppLeft,
      pp_max: ppMax,
      power: moveData.power ?? 0,
      accuracy: moveData.accuracy ?? 0,
      enabled,
    });
    actionMask[slot] = enabled ? 1 : 0;
  }

  return {
    decision_type: "combat_command",
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    is_double_battle: game.scene.currentBattle.double,
    ui_mode: getUiModeName(game.scene.ui.getMode()),
    player: buildBattlerSnapshot(playerPokemon),
    enemy: buildBattlerSnapshot(enemyPokemon),
    actions,
    action_mask: actionMask,
  };
}

function toModifierOptionSnapshot(option: any, index: number): ModifierOptionSnapshot {
  const modifierType = option.modifierTypeOption?.type;
  return {
    index,
    modifier_type_id: modifierType?.id ?? modifierType?.name ?? modifierType?.constructor?.name ?? "unknown",
    cost: option.modifierTypeOption.cost,
    upgrade_count: option.modifierTypeOption.upgradeCount,
    tier: modifierType?.tier ?? -1,
  };
}

function getModifierTypeIdFromOption(option: any): string {
  const modifierType = option.modifierTypeOption?.type;
  return modifierType?.id ?? modifierType?.name ?? modifierType?.constructor?.name ?? "unknown";
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

function getModifierAvailability(
  game: GameManager,
  option: any,
): { available: boolean; reason?: string } {
  const modifierTypeId = getModifierTypeIdFromOption(option);
  const partyFlags = getPartyResourceFlags(game);
  const cost = option.modifierTypeOption?.cost ?? 0;

  if (cost > game.scene.money) {
    return {
      available: false,
      reason: "insufficient_money",
    };
  }

  if (modifierTypeId === "POTION" && !partyFlags.hasMissingHp) {
    return {
      available: false,
      reason: "no_injured_pokemon",
    };
  }

  if (modifierTypeId === "REVIVE" && !partyFlags.hasFaintedPokemon) {
    return {
      available: false,
      reason: "no_fainted_pokemon",
    };
  }

  if (modifierTypeId.includes("ETHER") && !partyFlags.hasMissingPp) {
    return {
      available: false,
      reason: "no_missing_pp",
    };
  }

  return {
    available: true,
  };
}

function getModifierHandler(game: GameManager): ModifierSelectUiHandler {
  const handler = game.scene.ui.handlers.find(h => h instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function buildModifierDecisionPoint(game: GameManager): ModifierDecisionPoint {
  const handler = getModifierHandler(game);
  const actions: ModifierActionSnapshot[] = [];
  const actionMask: number[] = [];

  handler.options.forEach((option, index) => {
    actions.push({
      action_index: actions.length,
      action_type: "take_reward",
      reward_index: index,
      modifier_type_id: getModifierTypeIdFromOption(option),
      cost: option.modifierTypeOption?.cost ?? 0,
      available: true,
    });
    actionMask.push(1);
  });

  handler.shopOptionsRows.forEach((row, rowIndex) => {
    row.forEach((option, columnIndex) => {
      const availability = getModifierAvailability(game, option);
      actions.push({
        action_index: actions.length,
        action_type: "buy_shop_item",
        shop_row_index: rowIndex,
        shop_column_index: columnIndex,
        modifier_type_id: getModifierTypeIdFromOption(option),
        cost: option.modifierTypeOption?.cost ?? 0,
        available: availability.available,
        unavailable_reason: availability.reason,
      });
      actionMask.push(availability.available ? 1 : 0);
    });
  });

  actions.push({
    action_index: actions.length,
    action_type: "skip",
    cost: 0,
    available: true,
  });
  actionMask.push(1);

  return {
    decision_type: "modifier_select",
    wave_index: game.scene.currentBattle.waveIndex,
    ui_mode: getUiModeName(game.scene.ui.getMode()),
    reward_options: handler.options.map((option, index) => toModifierOptionSnapshot(option, index)),
    shop_rows: handler.shopOptionsRows.map(row => row.map((option, index) => toModifierOptionSnapshot(option, index))),
    actions,
    action_mask: actionMask,
    skip_available: true,
  };
}

function findFirstEnabledMove(decision: CombatDecisionPoint): CombatActionSnapshot {
  const action = decision.actions.find(candidate => candidate.enabled);
  if (!action) {
    throw new Error("No enabled combat action available");
  }
  return action;
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

async function executeSkipModifierAction(game: GameManager): Promise<void> {
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

async function executeModifierStrategy(
  game: GameManager,
  _decision: ModifierDecisionPoint,
  strategy: ModifierStrategy,
): Promise<void> {
  switch (strategy) {
    case "skip":
      await executeSkipModifierAction(game);
      return;
    default:
      throw new Error(`Unsupported modifier strategy: ${strategy}`);
  }
}

describe("tactical rl sim smoke", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override
      .seed(SEED)
      .disableTrainerWaves()
      .moveset([MoveId.FISSURE, MoveId.SPLASH])
      .ability(AbilityId.NO_GUARD)
      .startingLevel(200)
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyMoveset(MoveId.SPLASH);
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  it("collects tactical combat and modifier decision points", async () => {
    const decisions: DecisionPoint[] = [];
    let completedWaves = 0;
    let terminationReason = "unknown";

    await game.classicMode.startBattle(STARTER_SPECIES);

    while (completedWaves < MAX_WAVES) {
      const combatDecision = buildCombatDecisionPoint(game);
      decisions.push(combatDecision);

      if (combatDecision.is_double_battle) {
        terminationReason = "double_battle_not_supported";
        break;
      }

      const openingAction = findFirstEnabledMove(combatDecision);
      game.move.select(openingAction.move_id as MoveId);

      await game.phaseInterceptor.to("SelectModifierPhase");
      const modifierDecision = buildModifierDecisionPoint(game);
      decisions.push(modifierDecision);
      completedWaves += 1;

      await executeModifierStrategy(game, modifierDecision, MODIFIER_STRATEGY);

      if (completedWaves >= MAX_WAVES) {
        terminationReason = "max_waves_reached";
        break;
      }
    }

    if (terminationReason === "unknown") {
      terminationReason = completedWaves >= MAX_WAVES ? "max_waves_reached" : "loop_ended_without_reason";
    }

    const payload = {
      seed: SEED,
      max_waves: MAX_WAVES,
      modifier_strategy: MODIFIER_STRATEGY,
      generated_at: new Date().toISOString(),
      completed_waves: completedWaves,
      termination_reason: terminationReason,
      decision_count: decisions.length,
      decision_types: decisions.map(decision => decision.decision_type),
      decisions,
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), { encoding: "utf8" });
  });
});
