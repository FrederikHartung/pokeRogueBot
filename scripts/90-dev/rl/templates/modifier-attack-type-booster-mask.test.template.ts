import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { MoveId } from "#enums/move-id";
import { PokemonType } from "#enums/pokemon-type";
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

type BoosterCase = {
  itemName: string;
  moveType: PokemonType;
  validSpecies: SpeciesId;
  validMove: MoveId;
  invalidNonStabSpecies: SpeciesId;
  invalidSameTypeSpecies: SpeciesId;
  invalidSameTypeFallbackMove: MoveId;
};

const boosterCases: BoosterCase[] = [
  { itemName: "SILK_SCARF", moveType: PokemonType.NORMAL, validSpecies: SpeciesId.EEVEE, validMove: MoveId.TACKLE, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.EEVEE, invalidSameTypeFallbackMove: MoveId.BITE },
  { itemName: "BLACK_BELT", moveType: PokemonType.FIGHTING, validSpecies: SpeciesId.MANKEY, validMove: MoveId.KARATE_CHOP, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.MANKEY, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "SHARP_BEAK", moveType: PokemonType.FLYING, validSpecies: SpeciesId.PIDGEY, validMove: MoveId.WING_ATTACK, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.PIDGEY, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "POISON_BARB", moveType: PokemonType.POISON, validSpecies: SpeciesId.EKANS, validMove: MoveId.SLUDGE, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.EKANS, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "SOFT_SAND", moveType: PokemonType.GROUND, validSpecies: SpeciesId.SANDSHREW, validMove: MoveId.MUD_SHOT, invalidNonStabSpecies: SpeciesId.SQUIRTLE, invalidSameTypeSpecies: SpeciesId.SANDSHREW, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "HARD_STONE", moveType: PokemonType.ROCK, validSpecies: SpeciesId.GEODUDE, validMove: MoveId.ROCK_THROW, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.GEODUDE, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "SILVER_POWDER", moveType: PokemonType.BUG, validSpecies: SpeciesId.CATERPIE, validMove: MoveId.BUG_BITE, invalidNonStabSpecies: SpeciesId.SQUIRTLE, invalidSameTypeSpecies: SpeciesId.CATERPIE, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "SPELL_TAG", moveType: PokemonType.GHOST, validSpecies: SpeciesId.GASTLY, validMove: MoveId.LICK, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.GASTLY, invalidSameTypeFallbackMove: MoveId.CONFUSION },
  { itemName: "METAL_COAT", moveType: PokemonType.STEEL, validSpecies: SpeciesId.MAGNEMITE, validMove: MoveId.METAL_CLAW, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.MAGNEMITE, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "CHARCOAL", moveType: PokemonType.FIRE, validSpecies: SpeciesId.CHARMANDER, validMove: MoveId.EMBER, invalidNonStabSpecies: SpeciesId.SQUIRTLE, invalidSameTypeSpecies: SpeciesId.CHARMANDER, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "MYSTIC_WATER", moveType: PokemonType.WATER, validSpecies: SpeciesId.SQUIRTLE, validMove: MoveId.WATER_GUN, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.SQUIRTLE, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "MIRACLE_SEED", moveType: PokemonType.GRASS, validSpecies: SpeciesId.BULBASAUR, validMove: MoveId.VINE_WHIP, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.BULBASAUR, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "MAGNET", moveType: PokemonType.ELECTRIC, validSpecies: SpeciesId.PIKACHU, validMove: MoveId.THUNDER_SHOCK, invalidNonStabSpecies: SpeciesId.SQUIRTLE, invalidSameTypeSpecies: SpeciesId.PIKACHU, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "TWISTED_SPOON", moveType: PokemonType.PSYCHIC, validSpecies: SpeciesId.ABRA, validMove: MoveId.CONFUSION, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.ABRA, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "NEVER_MELT_ICE", moveType: PokemonType.ICE, validSpecies: SpeciesId.SPHEAL, validMove: MoveId.POWDER_SNOW, invalidNonStabSpecies: SpeciesId.SQUIRTLE, invalidSameTypeSpecies: SpeciesId.SPHEAL, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "DRAGON_FANG", moveType: PokemonType.DRAGON, validSpecies: SpeciesId.DRATINI, validMove: MoveId.DRAGON_BREATH, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.DRATINI, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "BLACK_GLASSES", moveType: PokemonType.DARK, validSpecies: SpeciesId.POOCHYENA, validMove: MoveId.BITE, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.POOCHYENA, invalidSameTypeFallbackMove: MoveId.TACKLE },
  { itemName: "FAIRY_FEATHER", moveType: PokemonType.FAIRY, validSpecies: SpeciesId.RALTS, validMove: MoveId.FAIRY_WIND, invalidNonStabSpecies: SpeciesId.CHARMANDER, invalidSameTypeSpecies: SpeciesId.RALTS, invalidSameTypeFallbackMove: MoveId.CONFUSION },
];

const validatedItems: string[] = [];

function getModifierSelectHandler(): ModifierSelectUiHandler {
  const handler = scene.ui.handlers.find(candidate => candidate instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function setSingleMove(partyIndex: number, primaryMove: MoveId, fallbackMove?: MoveId): void {
  const pokemon = scene.getPlayerParty()[partyIndex];
  if (!pokemon) {
    throw new Error(`Missing pokemon at party index ${partyIndex}`);
  }
  pokemon.setMove(0, primaryMove);
  if (fallbackMove !== undefined) {
    pokemon.setMove(1, fallbackMove);
  }
}

function hasStabAttackMoveOfType(pokemon: any, moveType: PokemonType): boolean {
  return (
    pokemon.isOfType(moveType, false)
    && pokemon
      .getMoveset(true)
      .some((pokemonMove: any) => pokemonMove?.getMove?.()?.is?.("AttackMove") && pokemonMove.getMove().type === moveType)
  );
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

it.each(boosterCases)("masks %s only for pokemon with matching STAB attack moves", async ({ itemName, moveType, validSpecies, validMove, invalidNonStabSpecies, invalidSameTypeSpecies, invalidSameTypeFallbackMove }) => {
  initSceneWithoutEncounterPhase(scene, [validSpecies, invalidNonStabSpecies, invalidSameTypeSpecies]);
  setSingleMove(0, validMove);
  setSingleMove(1, validMove);
  setSingleMove(2, invalidSameTypeFallbackMove);

  const modifierType = modifierTypes.ATTACK_TYPE_BOOSTER().generateType(scene.getPlayerParty(), [moveType]);
  if (!modifierType) {
    throw new Error(`Failed to generate attack type booster for ${itemName}`);
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
  const availability = party.map(pokemon =>
    hasStabAttackMoveOfType(pokemon, moveType),
  );
  const actionMask = availability.map(value => (value ? 1 : 0));

  expect(modifierType.constructor.name).toBe("AttackTypeBoosterModifierType");
  expect(availability).toEqual([true, false, false]);
  expect(actionMask).toEqual([1, 0, 0]);
  validatedItems.push(itemName);
});

it("writes attack type booster validation summary", () => {
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

  expect(validatedItems).toEqual(boosterCases.map(testCase => testCase.itemName));
});
