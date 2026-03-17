import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesId } from "#enums/species-id";
import type { PokemonBaseStatTotalModifier } from "#modifiers/modifier";
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

type BaseStatTotalCase = {
  label: string;
  statModifier: 10 | -15;
};

type TargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  available: boolean;
  unavailable_reason: string | null;
  stack_count: number;
  max_stack_count: number;
};

const baseStatTotalCases: BaseStatTotalCase[] = [
  { label: "SHUCKLE_JUICE_GOOD", statModifier: 10 },
  { label: "SHUCKLE_JUICE_BAD", statModifier: -15 },
];

const validatedVariants: string[] = [];

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
  ) as PokemonBaseStatTotalModifier | undefined;
  const dummyModifier = option.type.newModifier(pokemon) as PokemonBaseStatTotalModifier;

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

it.each(baseStatTotalCases)("masks %s only when the target already reached the stack cap", async ({ label, statModifier }) => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const playerParty = scene.getPlayerParty();
  const cappedTarget = playerParty[0];
  if (!cappedTarget) {
    throw new Error("Expected player party target at index 0");
  }

  const modifierType = modifierTypes.MYSTERY_ENCOUNTER_SHUCKLE_JUICE().generateType(scene.getPlayerParty(), [statModifier]);
  if (!modifierType) {
    throw new Error(`Failed to generate base stat total modifier for ${label}`);
  }

  const existingModifier = modifierType.newModifier(cappedTarget) as PokemonBaseStatTotalModifier;
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
  expect(option?.type.constructor.name).toBe("PokemonBaseStatTotalModifierType");

  const targets = playerParty.map((pokemon, partyIndex) => buildTargetSnapshot(pokemon, option, partyIndex));
  const actionMask = targets.map(target => (target.available ? 1 : 0));

  expect(targets[0]?.available).toBe(false);
  expect(targets[0]?.stack_count).toEqual(targets[0]?.max_stack_count);
  expect(targets[1]?.available).toBe(true);
  expect(targets[2]?.available).toBe(true);
  expect(actionMask).toEqual([0, 1, 1]);

  validatedVariants.push(label);
});

it("writes base stat total validation summary", () => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_variants: validatedVariants,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedVariants).toEqual(baseStatTotalCases.map(testCase => testCase.label));
});
