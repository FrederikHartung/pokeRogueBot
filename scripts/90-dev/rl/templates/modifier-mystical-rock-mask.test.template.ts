import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { ModifierPoolType } from "#enums/modifier-pool-type";
import { ModifierTier } from "#enums/modifier-tier";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import type { FieldEffectModifier } from "#modifiers/modifier";
import type { WeightedModifierType } from "#modifiers/modifier-type";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { SelectModifierPhase } from "#phases/select-modifier-phase";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
import { getModifierPoolForType, getModifierType } from "#utils/modifier-utils";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const OUTPUT_PATH = __OUTPUT_PATH__;

let phaserGame: Phaser.Game;
let game: GameManager;
let scene: BattleScene;

type TargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  available: boolean;
  unavailable_reason: string | null;
  stack_count: number;
  max_stack_count: number;
};

const validatedItems: string[] = [];

function getModifierSelectHandler(): ModifierSelectUiHandler {
  const handler = scene.ui.handlers.find(candidate => candidate instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function setSingleMove(partyIndex: number, move: MoveId): void {
  const pokemon = scene.getPlayerParty()[partyIndex];
  if (!pokemon) {
    throw new Error(`Missing pokemon at party index ${partyIndex}`);
  }
  pokemon.setMove(0, move);
}

function buildTargetSnapshot(pokemon: any, option: ModifierTypeOption, targetPartyIndex: number): TargetSnapshot {
  const filterResult = option.type.selectFilter ? option.type.selectFilter(pokemon) : null;
  const existingModifier = scene.findModifier(
    modifier => modifier.pokemonId === pokemon.id && modifier.matchType(option.type.newModifier(pokemon)),
  ) as FieldEffectModifier | undefined;
  const dummyModifier = option.type.newModifier(pokemon) as FieldEffectModifier;

  return {
    target_party_index: targetPartyIndex,
    pokemon_name: pokemon.getNameToRender(),
    available: !filterResult,
    unavailable_reason: filterResult,
    stack_count: existingModifier?.getStackCount() ?? 0,
    max_stack_count: dummyModifier.getMaxStackCount(),
  };
}

function getMysticalRockWeight(party: any[]): number {
  const ultraPool = getModifierPoolForType(ModifierPoolType.PLAYER)[ModifierTier.ULTRA];
  const mysticalRockEntry = ultraPool.find(
    entry => (entry as WeightedModifierType).modifierType.id === "MYSTICAL_ROCK",
  ) as WeightedModifierType | undefined;

  if (!mysticalRockEntry) {
    throw new Error("MYSTICAL_ROCK entry not found in player ultra modifier pool");
  }

  return typeof mysticalRockEntry.weight === "function" ? mysticalRockEntry.weight(party, 0) : mysticalRockEntry.weight;
}

beforeAll(() => {
  phaserGame = new Phaser.Game({
    type: Phaser.HEADLESS,
  });
});

beforeEach(() => {
  game = new GameManager(phaserGame);
  scene = game.scene;
});

afterEach(() => {
  game.phaseInterceptor.restoreOg();
});

it("only has shop weight when a non-capped party member can extend weather or terrain", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const playerParty = scene.getPlayerParty();

  setSingleMove(0, MoveId.SPLASH);
  setSingleMove(1, MoveId.SPLASH);
  setSingleMove(2, MoveId.SPLASH);
  expect(getMysticalRockWeight(playerParty)).toBe(0);

  setSingleMove(0, MoveId.SUNNY_DAY);
  expect(getMysticalRockWeight(playerParty)).toBe(10);

  const cappedTarget = playerParty[0];
  if (!cappedTarget) {
    throw new Error("Expected player party target at index 0");
  }

  const modifierType = getModifierType(modifierTypes.MYSTICAL_ROCK);
  const existingModifier = modifierType.newModifier(cappedTarget) as FieldEffectModifier;
  existingModifier.stackCount = existingModifier.getMaxStackCount();
  scene.addModifier(existingModifier, true, false, false, true);
  await scene.updateModifiers(true);

  expect(getMysticalRockWeight(playerParty)).toBe(0);

  validatedItems.push("MYSTICAL_ROCK_POOL");
});

it("masks MYSTICAL_ROCK only for targets that already reached the stack cap once the item is offered", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  setSingleMove(0, MoveId.SUNNY_DAY);
  setSingleMove(1, MoveId.SPLASH);
  setSingleMove(2, MoveId.RAIN_DANCE);

  const playerParty = scene.getPlayerParty();
  const cappedTarget = playerParty[2];
  if (!cappedTarget) {
    throw new Error("Expected player party target at index 2");
  }

  const modifierType = getModifierType(modifierTypes.MYSTICAL_ROCK);
  const existingModifier = modifierType.newModifier(cappedTarget) as FieldEffectModifier;
  existingModifier.stackCount = existingModifier.getMaxStackCount();
  scene.addModifier(existingModifier, true, false, false, true);
  await scene.updateModifiers(true);

  const forcedReward = new ModifierTypeOption(modifierType, 0);
  scene.phaseManager.unshiftPhase(
    new SelectModifierPhase(0, undefined, {
      guaranteedModifierTypeOptions: [forcedReward],
    }),
  );
  await game.phaseInterceptor.to("SelectModifierPhase");

  const handler = getModifierSelectHandler();
  expect(handler.options.length).toBeGreaterThanOrEqual(1);

  const option = handler.options[0]?.modifierTypeOption;
  expect(option?.type.constructor.name).toBe("PokemonHeldItemModifierType");

  const targets = playerParty.map((pokemon, partyIndex) => buildTargetSnapshot(pokemon, option, partyIndex));
  const actionMask = targets.map(target => (target.available ? 1 : 0));

  expect(targets[0]?.available).toBe(true);
  expect(targets[1]?.available).toBe(true);
  expect(targets[2]?.available).toBe(false);
  expect(targets[2]?.stack_count).toEqual(targets[2]?.max_stack_count);
  expect(targets[2]?.max_stack_count).toBe(2);
  expect(actionMask).toEqual([1, 1, 0]);

  validatedItems.push("MYSTICAL_ROCK");
});

it("writes mystical rock validation summary", () => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_items: validatedItems,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedItems).toEqual(["MYSTICAL_ROCK_POOL", "MYSTICAL_ROCK"]);
});
