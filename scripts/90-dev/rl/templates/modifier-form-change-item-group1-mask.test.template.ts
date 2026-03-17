import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesFormKey } from "#enums/species-form-key";
import { SpeciesId } from "#enums/species-id";
import { FormChangeItem } from "#enums/form-change-item";
import type { PlayerPokemon } from "#field/pokemon";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, expect, it } from "vitest";

type PartyTargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  available: boolean;
  unavailable_reason: string | null;
};

type FormChangeCase = {
  item: FormChangeItem;
  species: SpeciesId;
  preFormKey?: string;
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
  if (formKey === "") {
    pokemon.formIndex = 0;
    return;
  }
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

const group1Cases: FormChangeCase[] = [
  { item: FormChangeItem.ABOMASITE, species: SpeciesId.ABOMASNOW },
  { item: FormChangeItem.ABSOLITE, species: SpeciesId.ABSOL },
  { item: FormChangeItem.AERODACTYLITE, species: SpeciesId.AERODACTYL },
  { item: FormChangeItem.AGGRONITE, species: SpeciesId.AGGRON },
  { item: FormChangeItem.ALAKAZITE, species: SpeciesId.ALAKAZAM },
  { item: FormChangeItem.ALTARIANITE, species: SpeciesId.ALTARIA },
  { item: FormChangeItem.AMPHAROSITE, species: SpeciesId.AMPHAROS },
  { item: FormChangeItem.AUDINITE, species: SpeciesId.AUDINO },
  { item: FormChangeItem.BANETTITE, species: SpeciesId.BANETTE },
  { item: FormChangeItem.BEEDRILLITE, species: SpeciesId.BEEDRILL },
  { item: FormChangeItem.BLASTOISINITE, species: SpeciesId.BLASTOISE },
  { item: FormChangeItem.BLAZIKENITE, species: SpeciesId.BLAZIKEN },
  { item: FormChangeItem.CAMERUPTITE, species: SpeciesId.CAMERUPT },
  { item: FormChangeItem.CHARIZARDITE_X, species: SpeciesId.CHARIZARD },
  { item: FormChangeItem.CHARIZARDITE_Y, species: SpeciesId.CHARIZARD },
  { item: FormChangeItem.DIANCITE, species: SpeciesId.DIANCIE },
  { item: FormChangeItem.GALLADITE, species: SpeciesId.GALLADE },
  { item: FormChangeItem.GARCHOMPITE, species: SpeciesId.GARCHOMP },
  { item: FormChangeItem.GARDEVOIRITE, species: SpeciesId.GARDEVOIR },
  { item: FormChangeItem.GENGARITE, species: SpeciesId.GENGAR },
  { item: FormChangeItem.GLALITITE, species: SpeciesId.GLALIE },
  { item: FormChangeItem.GYARADOSITE, species: SpeciesId.GYARADOS },
  { item: FormChangeItem.HERACRONITE, species: SpeciesId.HERACROSS },
  { item: FormChangeItem.HOUNDOOMINITE, species: SpeciesId.HOUNDOOM },
  { item: FormChangeItem.KANGASKHANITE, species: SpeciesId.KANGASKHAN },
  { item: FormChangeItem.LATIASITE, species: SpeciesId.LATIAS },
  { item: FormChangeItem.LATIOSITE, species: SpeciesId.LATIOS },
  { item: FormChangeItem.LOPUNNITE, species: SpeciesId.LOPUNNY },
  { item: FormChangeItem.LUCARIONITE, species: SpeciesId.LUCARIO },
  { item: FormChangeItem.MANECTITE, species: SpeciesId.MANECTRIC },
  { item: FormChangeItem.MAWILITE, species: SpeciesId.MAWILE },
  { item: FormChangeItem.MEDICHAMITE, species: SpeciesId.MEDICHAM },
  { item: FormChangeItem.METAGROSSITE, species: SpeciesId.METAGROSS },
  { item: FormChangeItem.MEWTWONITE_X, species: SpeciesId.MEWTWO },
  { item: FormChangeItem.MEWTWONITE_Y, species: SpeciesId.MEWTWO },
  { item: FormChangeItem.PIDGEOTITE, species: SpeciesId.PIDGEOT },
  { item: FormChangeItem.PINSIRITE, species: SpeciesId.PINSIR },
  { item: FormChangeItem.RAYQUAZITE, species: SpeciesId.RAYQUAZA },
  { item: FormChangeItem.SABLENITE, species: SpeciesId.SABLEYE },
  { item: FormChangeItem.SALAMENCITE, species: SpeciesId.SALAMENCE },
  { item: FormChangeItem.SCEPTILITE, species: SpeciesId.SCEPTILE },
  { item: FormChangeItem.SCIZORITE, species: SpeciesId.SCIZOR },
  { item: FormChangeItem.SHARPEDONITE, species: SpeciesId.SHARPEDO },
  { item: FormChangeItem.SLOWBRONITE, species: SpeciesId.SLOWBRO },
  { item: FormChangeItem.STEELIXITE, species: SpeciesId.STEELIX },
  { item: FormChangeItem.SWAMPERTITE, species: SpeciesId.SWAMPERT },
  { item: FormChangeItem.TYRANITARITE, species: SpeciesId.TYRANITAR },
  { item: FormChangeItem.VENUSAURITE, species: SpeciesId.VENUSAUR },
  { item: FormChangeItem.BLUE_ORB, species: SpeciesId.KYOGRE },
  { item: FormChangeItem.RED_ORB, species: SpeciesId.GROUDON },
  { item: FormChangeItem.ADAMANT_CRYSTAL, species: SpeciesId.DIALGA },
  { item: FormChangeItem.LUSTROUS_GLOBE, species: SpeciesId.PALKIA },
  { item: FormChangeItem.GRISEOUS_CORE, species: SpeciesId.GIRATINA, preFormKey: "altered" },
  { item: FormChangeItem.REVEAL_GLASS, species: SpeciesId.TORNADUS, preFormKey: SpeciesFormKey.INCARNATE },
  { item: FormChangeItem.MAX_MUSHROOMS, species: SpeciesId.VENUSAUR },
  { item: FormChangeItem.PRISON_BOTTLE, species: SpeciesId.HOOPA },
  { item: FormChangeItem.RUSTED_SWORD, species: SpeciesId.ZACIAN, preFormKey: "hero-of-many-battles" },
  { item: FormChangeItem.RUSTED_SHIELD, species: SpeciesId.ZAMAZENTA, preFormKey: "hero-of-many-battles" },
  { item: FormChangeItem.SHARP_METEORITE, species: SpeciesId.DEOXYS, preFormKey: "normal" },
  { item: FormChangeItem.HARD_METEORITE, species: SpeciesId.DEOXYS, preFormKey: "normal" },
  { item: FormChangeItem.SMOOTH_METEORITE, species: SpeciesId.DEOXYS, preFormKey: "normal" },
  { item: FormChangeItem.GRACIDEA, species: SpeciesId.SHAYMIN, preFormKey: "land" },
  { item: FormChangeItem.SHOCK_DRIVE, species: SpeciesId.GENESECT },
  { item: FormChangeItem.BURN_DRIVE, species: SpeciesId.GENESECT },
  { item: FormChangeItem.CHILL_DRIVE, species: SpeciesId.GENESECT },
  { item: FormChangeItem.DOUSE_DRIVE, species: SpeciesId.GENESECT },
  { item: FormChangeItem.WELLSPRING_MASK, species: SpeciesId.OGERPON, preFormKey: "teal-mask" },
  { item: FormChangeItem.HEARTHFLAME_MASK, species: SpeciesId.OGERPON, preFormKey: "teal-mask" },
  { item: FormChangeItem.CORNERSTONE_MASK, species: SpeciesId.OGERPON, preFormKey: "teal-mask" },
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

it.each(group1Cases)("validates group-1 form change mask for $item", ({ item, species, preFormKey }) => {
  const party = initPartyWithEligibleSpecies(species);
  const eligiblePokemon = party[0];
  if (!eligiblePokemon) {
    throw new Error("Expected eligible pokemon at party index 0");
  }

  if (preFormKey !== undefined) {
    setFormByKey(eligiblePokemon, preFormKey);
  }

  const modifierType = modifierTypes.FORM_CHANGE_ITEM().generateType(scene.getPlayerParty(), [item]);
  if (!modifierType) {
    throw new Error(`Failed to generate form change item modifier for ${FormChangeItem[item]}`);
  }

  const option = new ModifierTypeOption(modifierType, 0, 0);
  const targets = party.map((pokemon, targetPartyIndex) => buildPartyTargetSnapshot(option, pokemon, targetPartyIndex));

  expect(targets[0]?.available).toBe(true);
  expect(targets[1]?.available).toBe(false);
  expect(targets[2]?.available).toBe(false);

  validatedItems.push({
    item_name: FormChangeItem[item],
    eligible_pokemon: SpeciesId[species],
  });
});

it("writes validated form change item summary", () => {
  const formChangeItemNames = group1Cases.map(testCase => FormChangeItem[testCase.item]);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_items: validatedItems,
        form_change_item_names: formChangeItemNames,
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedItems).toHaveLength(group1Cases.length);
});
