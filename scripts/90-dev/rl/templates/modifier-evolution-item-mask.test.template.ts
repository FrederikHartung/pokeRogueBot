import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { BiomeId } from "#enums/biome-id";
import { TimeOfDay } from "#enums/time-of-day";
import { SpeciesId } from "#enums/species-id";
import type { PlayerPokemon } from "#field/pokemon";
import { EvolutionItem } from "#balance/pokemon-evolutions";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

type PartyTargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  available: boolean;
  unavailable_reason: string | null;
};

type EvolutionCase = {
  item: EvolutionItem;
  species: SpeciesId;
  prepare?: (pokemon: PlayerPokemon, scene: BattleScene) => void;
};

const OUTPUT_PATH = __OUTPUT_PATH__;

let phaserGame: Phaser.Game;
let game: GameManager;
let scene: BattleScene;
const validatedItems: Array<{ item_name: string; eligible_pokemon: string }> = [];

function buildPartyTargetSnapshot(option: ModifierTypeOption, pokemon: PlayerPokemon, targetPartyIndex: number): PartyTargetSnapshot {
  const filterResult = option.type.selectFilter ? option.type.selectFilter(pokemon) : null;
  return {
    target_party_index: targetPartyIndex,
    pokemon_name: pokemon.getNameToRender(),
    available: !filterResult,
    unavailable_reason: filterResult,
  };
}

function setFormByKey(pokemon: PlayerPokemon, formKey: string): void {
  const formIndex = pokemon.species.forms.findIndex(form => form.formKey === formKey);
  if (formIndex < 0) {
    throw new Error(`Form key ${formKey} not found for ${pokemon.getNameToRender()}`);
  }
  pokemon.formIndex = formIndex;
}

function initPartyWithEligibleSpecies(species: SpeciesId): PlayerPokemon[] {
  initSceneWithoutEncounterPhase(scene, [species, SpeciesId.BULBASAUR, SpeciesId.CHARMANDER]);
  return scene.getPlayerParty();
}

const evolutionCases: EvolutionCase[] = [
  { item: EvolutionItem.LINKING_CORD, species: SpeciesId.HAUNTER },
  { item: EvolutionItem.SUN_STONE, species: SpeciesId.COTTONEE },
  { item: EvolutionItem.MOON_STONE, species: SpeciesId.NIDORINA },
  { item: EvolutionItem.LEAF_STONE, species: SpeciesId.GLOOM },
  { item: EvolutionItem.FIRE_STONE, species: SpeciesId.VULPIX },
  { item: EvolutionItem.WATER_STONE, species: SpeciesId.PANPOUR },
  { item: EvolutionItem.THUNDER_STONE, species: SpeciesId.EELEKTRIK },
  { item: EvolutionItem.ICE_STONE, species: SpeciesId.CRABRAWLER },
  { item: EvolutionItem.DUSK_STONE, species: SpeciesId.MURKROW },
  { item: EvolutionItem.DAWN_STONE, species: SpeciesId.PETILIL },
  { item: EvolutionItem.SHINY_STONE, species: SpeciesId.MINCCINO },
  { item: EvolutionItem.CRACKED_POT, species: SpeciesId.SINISTEA },
  { item: EvolutionItem.SWEET_APPLE, species: SpeciesId.APPLIN },
  { item: EvolutionItem.TART_APPLE, species: SpeciesId.APPLIN },
  {
    item: EvolutionItem.STRAWBERRY_SWEET,
    species: SpeciesId.MILCERY,
    prepare: (_pokemon, battleScene) => {
      battleScene.arena.biomeType = BiomeId.TOWN;
    },
  },
  { item: EvolutionItem.UNREMARKABLE_TEACUP, species: SpeciesId.POLTCHAGEIST },
  { item: EvolutionItem.UPGRADE, species: SpeciesId.PORYGON },
  { item: EvolutionItem.DUBIOUS_DISC, species: SpeciesId.PORYGON2 },
  { item: EvolutionItem.DRAGON_SCALE, species: SpeciesId.SEADRA },
  { item: EvolutionItem.PRISM_SCALE, species: SpeciesId.FEEBAS },
  {
    item: EvolutionItem.RAZOR_CLAW,
    species: SpeciesId.SNEASEL,
    prepare: (_pokemon, battleScene) => {
      vi.spyOn(battleScene.arena, "getTimeOfDay").mockReturnValue(TimeOfDay.NIGHT);
    },
  },
  {
    item: EvolutionItem.RAZOR_FANG,
    species: SpeciesId.GLIGAR,
    prepare: (_pokemon, battleScene) => {
      vi.spyOn(battleScene.arena, "getTimeOfDay").mockReturnValue(TimeOfDay.NIGHT);
    },
  },
  {
    item: EvolutionItem.OVAL_STONE,
    species: SpeciesId.HAPPINY,
    prepare: (_pokemon, battleScene) => {
      vi.spyOn(battleScene.arena, "getTimeOfDay").mockReturnValue(TimeOfDay.DAY);
    },
  },
  { item: EvolutionItem.REAPER_CLOTH, species: SpeciesId.DUSCLOPS },
  { item: EvolutionItem.ELECTIRIZER, species: SpeciesId.ELECTABUZZ },
  { item: EvolutionItem.MAGMARIZER, species: SpeciesId.MAGMAR },
  { item: EvolutionItem.PROTECTOR, species: SpeciesId.RHYDON },
  { item: EvolutionItem.SACHET, species: SpeciesId.SPRITZEE },
  { item: EvolutionItem.WHIPPED_DREAM, species: SpeciesId.SWIRLIX },
  { item: EvolutionItem.SYRUPY_APPLE, species: SpeciesId.APPLIN },
  {
    item: EvolutionItem.CHIPPED_POT,
    species: SpeciesId.SINISTEA,
    prepare: pokemon => {
      setFormByKey(pokemon, "antique");
    },
  },
  { item: EvolutionItem.GALARICA_CUFF, species: SpeciesId.GALAR_SLOWPOKE },
  { item: EvolutionItem.GALARICA_WREATH, species: SpeciesId.GALAR_SLOWPOKE },
  { item: EvolutionItem.AUSPICIOUS_ARMOR, species: SpeciesId.CHARCADET },
  { item: EvolutionItem.MALICIOUS_ARMOR, species: SpeciesId.CHARCADET },
  {
    item: EvolutionItem.MASTERPIECE_TEACUP,
    species: SpeciesId.POLTCHAGEIST,
    prepare: pokemon => {
      setFormByKey(pokemon, "artisan");
    },
  },
  {
    item: EvolutionItem.SUN_FLUTE,
    species: SpeciesId.COSMOEM,
    prepare: pokemon => {
      pokemon.level = 13;
    },
  },
  {
    item: EvolutionItem.MOON_FLUTE,
    species: SpeciesId.COSMOEM,
    prepare: pokemon => {
      pokemon.level = 13;
    },
  },
  { item: EvolutionItem.BLACK_AUGURITE, species: SpeciesId.SCYTHER },
  { item: EvolutionItem.PEAT_BLOCK, species: SpeciesId.URSARING },
  { item: EvolutionItem.METAL_ALLOY, species: SpeciesId.DURALUDON },
  { item: EvolutionItem.SCROLL_OF_DARKNESS, species: SpeciesId.KUBFU },
  { item: EvolutionItem.SCROLL_OF_WATERS, species: SpeciesId.KUBFU },
  { item: EvolutionItem.LEADERS_CREST, species: SpeciesId.BISHARP },
];

beforeAll(() => {
  phaserGame = new Phaser.Game({
    type: Phaser.HEADLESS,
  });
});

beforeEach(() => {
  game = new GameManager(phaserGame);
  scene = game.scene;
});

it.each(evolutionCases)("validates target mask for evolution item %s", ({ item, species, prepare }) => {
  const party = initPartyWithEligibleSpecies(species);
  const eligiblePokemon = party[0];
  if (!eligiblePokemon) {
    throw new Error("Expected eligible pokemon at party index 0");
  }

  prepare?.(eligiblePokemon, scene);

  const modifierType = modifierTypes.EVOLUTION_ITEM().generateType(scene.getPlayerParty(), [item]);
  if (!modifierType) {
    throw new Error(`Failed to generate evolution item modifier for ${EvolutionItem[item]}`);
  }

  const option = new ModifierTypeOption(modifierType, 0, 0);
  const targets = party.map((pokemon, targetPartyIndex) => buildPartyTargetSnapshot(option, pokemon, targetPartyIndex));

  expect(targets[0]?.available).toBe(true);
  expect(targets[1]?.available).toBe(false);
  expect(targets[2]?.available).toBe(false);

  validatedItems.push({
    item_name: EvolutionItem[item],
    eligible_pokemon: SpeciesId[species],
  });
});

it("writes validated evolution item summary", () => {
  const evolutionItemNames = Object.values(EvolutionItem).filter(value => typeof value === "string" && value !== "NONE");

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_items: validatedItems,
        evolution_item_names: evolutionItemNames,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedItems).toHaveLength(evolutionCases.length);
});
