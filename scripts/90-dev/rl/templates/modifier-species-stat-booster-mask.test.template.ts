import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesId } from "#enums/species-id";
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

type SpeciesStatBoosterCase = {
  itemName: string;
  validSpecies: SpeciesId;
  invalidSpeciesA: SpeciesId;
  invalidSpeciesB: SpeciesId;
};

const speciesStatBoosterCases: SpeciesStatBoosterCase[] = [
  { itemName: "LIGHT_BALL", validSpecies: SpeciesId.PIKACHU, invalidSpeciesA: SpeciesId.EEVEE, invalidSpeciesB: SpeciesId.CHARMANDER },
  { itemName: "THICK_CLUB", validSpecies: SpeciesId.CUBONE, invalidSpeciesA: SpeciesId.PIKACHU, invalidSpeciesB: SpeciesId.CLAMPERL },
  { itemName: "METAL_POWDER", validSpecies: SpeciesId.DITTO, invalidSpeciesA: SpeciesId.PIKACHU, invalidSpeciesB: SpeciesId.CLAMPERL },
  { itemName: "QUICK_POWDER", validSpecies: SpeciesId.DITTO, invalidSpeciesA: SpeciesId.PIKACHU, invalidSpeciesB: SpeciesId.CLAMPERL },
  { itemName: "DEEP_SEA_SCALE", validSpecies: SpeciesId.CLAMPERL, invalidSpeciesA: SpeciesId.PIKACHU, invalidSpeciesB: SpeciesId.DITTO },
  { itemName: "DEEP_SEA_TOOTH", validSpecies: SpeciesId.CLAMPERL, invalidSpeciesA: SpeciesId.PIKACHU, invalidSpeciesB: SpeciesId.DITTO },
];

const SPECIES_STAT_BOOSTER_ELIGIBLE_SPECIES: Record<string, SpeciesId[]> = {
  LIGHT_BALL: [SpeciesId.PIKACHU],
  THICK_CLUB: [SpeciesId.CUBONE, SpeciesId.MAROWAK, SpeciesId.ALOLA_MAROWAK],
  METAL_POWDER: [SpeciesId.DITTO],
  QUICK_POWDER: [SpeciesId.DITTO],
  DEEP_SEA_SCALE: [SpeciesId.CLAMPERL],
  DEEP_SEA_TOOTH: [SpeciesId.CLAMPERL],
};

const validatedItems: string[] = [];

function getModifierSelectHandler(): ModifierSelectUiHandler {
  const handler = scene.ui.handlers.find(candidate => candidate instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function hasEligibleSpecies(pokemon: any, itemName: string): boolean {
  const eligibleSpecies = SPECIES_STAT_BOOSTER_ELIGIBLE_SPECIES[itemName] ?? [];
  const speciesId = pokemon.getSpeciesForm(true).speciesId as SpeciesId;
  const fusionSpeciesId = pokemon.isFusion() ? (pokemon.getFusionSpeciesForm(true).speciesId as SpeciesId) : null;
  return eligibleSpecies.includes(speciesId) || (fusionSpeciesId !== null && eligibleSpecies.includes(fusionSpeciesId));
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

it.each(speciesStatBoosterCases)("masks %s only for matching species", async ({ itemName, validSpecies, invalidSpeciesA, invalidSpeciesB }) => {
  initSceneWithoutEncounterPhase(scene, [validSpecies, invalidSpeciesA, invalidSpeciesB]);

  const modifierType = modifierTypes.SPECIES_STAT_BOOSTER().generateType(scene.getPlayerParty(), [itemName]);
  if (!modifierType) {
    throw new Error(`Failed to generate species stat booster for ${itemName}`);
  }

  const forcedReward = new ModifierTypeOption(modifierType, 0);
  scene.phaseManager.unshiftPhase(
    new SelectModifierPhase(0, undefined, {
      guaranteedModifierTypeOptions: [forcedReward],
    }),
  );
  await game.phaseInterceptor.to("SelectModifierPhase");

  const handler = getModifierSelectHandler();
  expect(handler.options.length).toBeGreaterThanOrEqual(1);

  const party = scene.getPlayerParty();
  const availability = party.map(pokemon => hasEligibleSpecies(pokemon, itemName));
  const actionMask = availability.map(value => (value ? 1 : 0));

  expect(modifierType.constructor.name).toBe("SpeciesStatBoosterModifierType");
  expect(availability).toEqual([true, false, false]);
  expect(actionMask).toEqual([1, 0, 0]);
  validatedItems.push(itemName);
});

it("writes species stat booster validation summary", () => {
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

  expect(validatedItems).toEqual(speciesStatBoosterCases.map(testCase => testCase.itemName));
});
