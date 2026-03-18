import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesId } from "#enums/species-id";
import type { CritBoosterModifier } from "#modifiers/modifier";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { SelectModifierPhase } from "#phases/select-modifier-phase";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
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

function buildTargetSnapshot(pokemon: any, option: ModifierTypeOption, targetPartyIndex: number): TargetSnapshot {
  const filterResult = option.type.selectFilter ? option.type.selectFilter(pokemon) : null;
  const existingModifier = scene.findModifier(
    modifier => modifier.pokemonId === pokemon.id && modifier.matchType(option.type.newModifier(pokemon)),
  ) as CritBoosterModifier | undefined;
  const dummyModifier = option.type.newModifier(pokemon) as CritBoosterModifier;

  return {
    target_party_index: targetPartyIndex,
    pokemon_name: pokemon.getNameToRender(),
    available: !filterResult,
    unavailable_reason: filterResult,
    stack_count: existingModifier?.getStackCount() ?? 0,
    max_stack_count: dummyModifier.getMaxStackCount(),
  };
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

it("masks SCOPE_LENS only when the target already reached the stack cap", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const playerParty = scene.getPlayerParty();
  const cappedTarget = playerParty[0];
  if (!cappedTarget) {
    throw new Error("Expected player party target at index 0");
  }

  const modifierType = modifierTypes.SCOPE_LENS();
  const existingModifier = modifierType.newModifier(cappedTarget) as CritBoosterModifier;
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

  expect(targets[0]?.available).toBe(false);
  expect(targets[0]?.stack_count).toEqual(targets[0]?.max_stack_count);
  expect(targets[0]?.max_stack_count).toBe(1);
  expect(targets[1]?.available).toBe(true);
  expect(targets[2]?.available).toBe(true);
  expect(actionMask).toEqual([0, 1, 1]);

  validatedItems.push("SCOPE_LENS");
});

it("writes scope lens validation summary", () => {
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

  expect(validatedItems).toEqual(["SCOPE_LENS"]);
});
