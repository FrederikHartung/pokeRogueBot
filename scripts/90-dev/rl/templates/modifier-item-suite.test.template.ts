import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { MoveId } from "#enums/move-id";
import { Nature } from "#enums/nature";
import { StatusEffect } from "#enums/status-effect";
import { SpeciesId } from "#enums/species-id";
import type { PlayerPokemon } from "#field/pokemon";
import { Status } from "#data/status-effect";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { generateModifierType } from "#mystery-encounters/encounter-phase-utils";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, expect, it } from "vitest";

type PartyTargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  hp: number;
  max_hp: number;
  fainted: boolean;
  status: string | null;
  available: boolean;
  unavailable_reason: string | null;
};

type MoveTargetSnapshot = {
  move_index: number;
  move_name: string;
  pp_used: number;
  move_pp: number;
  pp_up: number;
  max_pp_override: number | null;
  available: boolean;
  unavailable_reason: string | null;
};

type ValidatedItemSummary = {
  item_id: string;
  target_type: "party" | "move";
  summary: string;
};

const OUTPUT_PATH = __OUTPUT_PATH__;

let phaserGame: Phaser.Game;
let game: GameManager;
let scene: BattleScene;
const validatedItems: ValidatedItemSummary[] = [];

function recordValidatedItem(itemId: string, targetType: "party" | "move", summary: string): void {
  validatedItems.push({ item_id: itemId, target_type: targetType, summary });
}

function initStarterScene(): PlayerPokemon[] {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);
  const party = scene.getPlayerParty();
  party[0]?.tryPopulateMoveset([MoveId.TACKLE, MoveId.GROWL, MoveId.VINE_WHIP]);
  party[1]?.tryPopulateMoveset([MoveId.SCRATCH, MoveId.GROWL, MoveId.EMBER]);
  party[2]?.tryPopulateMoveset([MoveId.TACKLE, MoveId.TAIL_WHIP, MoveId.WATER_GUN]);
  return party;
}

function buildPartyTargetSnapshot(option: ModifierTypeOption, pokemon: PlayerPokemon, targetPartyIndex: number): PartyTargetSnapshot {
  const filterResult = option.type.selectFilter ? option.type.selectFilter(pokemon) : null;
  return {
    target_party_index: targetPartyIndex,
    pokemon_name: pokemon.getNameToRender(),
    hp: pokemon.hp,
    max_hp: pokemon.getMaxHp(),
    fainted: pokemon.isFainted(),
    status: pokemon.status?.effect != null ? StatusEffect[pokemon.status.effect] : null,
    available: !filterResult,
    unavailable_reason: filterResult,
  };
}

function buildMoveTargetSnapshot(option: ModifierTypeOption, pokemon: PlayerPokemon): MoveTargetSnapshot[] {
  const moveSelectFilter = option.type.moveSelectFilter;
  return pokemon.getMoveset().map((move, moveIndex) => {
    const filterResult = moveSelectFilter ? moveSelectFilter(move) : null;
    return {
      move_index: moveIndex,
      move_name: move.getName(),
      pp_used: move.ppUsed,
      move_pp: move.getMovePp(),
      pp_up: move.ppUp,
      max_pp_override: move.maxPpOverride ?? null,
      available: !filterResult,
      unavailable_reason: filterResult,
    };
  });
}

function expectOnlyAvailablePartyTarget(targets: PartyTargetSnapshot[], expectedTargetIndex: number): void {
  targets.forEach(target => {
    expect(target.available).toBe(target.target_party_index === expectedTargetIndex);
  });
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

const potionCases = [
  { itemId: "POTION", option: () => new ModifierTypeOption(modifierTypes.POTION(), 0, 100) },
  { itemId: "SUPER_POTION", option: () => new ModifierTypeOption(modifierTypes.SUPER_POTION(), 0, 100) },
  { itemId: "HYPER_POTION", option: () => new ModifierTypeOption(modifierTypes.HYPER_POTION(), 0, 100) },
  { itemId: "MAX_POTION", option: () => new ModifierTypeOption(modifierTypes.MAX_POTION(), 0, 100) },
  { itemId: "FULL_RESTORE", option: () => new ModifierTypeOption(modifierTypes.FULL_RESTORE(), 0, 100) },
] as const;

it.each(potionCases)("validates party target mask for $itemId", ({ itemId, option }) => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  const charmander = party[1];
  const squirtle = party[2];
  if (!bulbasaur || !charmander || !squirtle) {
    throw new Error("Expected starter trio");
  }

  bulbasaur.hp = Math.max(1, bulbasaur.getMaxHp() - 3);
  charmander.hp = 0;
  charmander.status = new Status(StatusEffect.FAINT);
  squirtle.hp = squirtle.getMaxHp();

  const targets = party.map((pokemon, targetPartyIndex) => buildPartyTargetSnapshot(option(), pokemon, targetPartyIndex));
  expectOnlyAvailablePartyTarget(targets, 0);
  recordValidatedItem(itemId, "party", "nur verletztes, nicht fainted Pokemon darf gewaehlt werden");
});

const reviveCases = [
  { itemId: "REVIVE", option: () => new ModifierTypeOption(modifierTypes.REVIVE(), 0, 100) },
  { itemId: "MAX_REVIVE", option: () => new ModifierTypeOption(modifierTypes.MAX_REVIVE(), 0, 100) },
] as const;

it.each(reviveCases)("validates party target mask for $itemId", ({ itemId, option }) => {
  const party = initStarterScene();
  const charmander = party[1];
  if (!charmander) {
    throw new Error("Expected Charmander in starter trio");
  }

  charmander.hp = 0;
  charmander.status = new Status(StatusEffect.FAINT);

  const targets = party.map((pokemon, targetPartyIndex) => buildPartyTargetSnapshot(option(), pokemon, targetPartyIndex));
  expectOnlyAvailablePartyTarget(targets, 1);
  recordValidatedItem(itemId, "party", "nur fainted Pokemon darf gewaehlt werden");
});

it("validates direct no-target handling for SACRED_ASH", () => {
  const option = new ModifierTypeOption(modifierTypes.SACRED_ASH(), 0, 100);
  expect(typeof option.type.selectFilter).toBe("undefined");
  expect(typeof option.type.moveSelectFilter).toBe("undefined");
  recordValidatedItem("SACRED_ASH", "party", "globaler Revive ohne Party- oder Move-Zielauswahl");
});

it("validates party target mask for FULL_HEAL", () => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  const charmander = party[1];
  if (!bulbasaur || !charmander) {
    throw new Error("Expected starter trio");
  }

  bulbasaur.status = new Status(StatusEffect.POISON);
  charmander.hp = 0;
  charmander.status = new Status(StatusEffect.FAINT);

  const targets = party.map((pokemon, targetPartyIndex) =>
    buildPartyTargetSnapshot(new ModifierTypeOption(modifierTypes.FULL_HEAL(), 0, 100), pokemon, targetPartyIndex),
  );
  expectOnlyAvailablePartyTarget(targets, 0);
  recordValidatedItem("FULL_HEAL", "party", "nur Pokemon mit Statusproblem darf gewaehlt werden");
});

it("validates party target mask for RARE_CANDY", () => {
  const party = initStarterScene();
  const targets = party.map((pokemon, targetPartyIndex) =>
    buildPartyTargetSnapshot(new ModifierTypeOption(modifierTypes.RARE_CANDY(), 0, 0), pokemon, targetPartyIndex),
  );
  targets.forEach(target => expect(target.available).toBe(true));
  recordValidatedItem("RARE_CANDY", "party", "alle Party-Slots sind grundsaetzlich legale Ziele");
});

it("validates party target mask for MINT", () => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  const charmander = party[1];
  const squirtle = party[2];
  if (!bulbasaur || !charmander || !squirtle) {
    throw new Error("Expected starter trio");
  }

  bulbasaur.setCustomNature(Nature.ADAMANT);
  charmander.setCustomNature(Nature.HARDY);
  squirtle.setCustomNature(Nature.MODEST);

  const adamantMint = generateModifierType(modifierTypes.MINT, [Nature.ADAMANT]);
  if (!adamantMint) {
    throw new Error("Failed to generate deterministic ADAMANT mint");
  }

  const targets = party.map((pokemon, targetPartyIndex) =>
    buildPartyTargetSnapshot(new ModifierTypeOption(adamantMint, 0, 0), pokemon, targetPartyIndex),
  );

  expect(targets[0]?.available).toBe(false);
  expect(targets[1]?.available).toBe(true);
  expect(targets[2]?.available).toBe(true);
  recordValidatedItem("MINT", "party", "nur Pokemon mit abweichender Ziel-Nature duerfen gewaehlt werden");
});

const elixirCases = [
  { itemId: "ELIXIR", option: () => new ModifierTypeOption(modifierTypes.ELIXIR(), 0, 100) },
  { itemId: "MAX_ELIXIR", option: () => new ModifierTypeOption(modifierTypes.MAX_ELIXIR(), 0, 100) },
] as const;

it.each(elixirCases)("validates party target mask for $itemId", ({ itemId, option }) => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  if (!bulbasaur) {
    throw new Error("Expected Bulbasaur in starter trio");
  }
  bulbasaur.getMoveset()[0]!.ppUsed = 1;

  const targets = party.map((pokemon, targetPartyIndex) => buildPartyTargetSnapshot(option(), pokemon, targetPartyIndex));
  expectOnlyAvailablePartyTarget(targets, 0);
  recordValidatedItem(itemId, "party", "nur Pokemon mit mindestens einem Move mit fehlender PP darf gewaehlt werden");
});

const etherCases = [
  { itemId: "ETHER", option: () => new ModifierTypeOption(modifierTypes.ETHER(), 0, 100) },
  { itemId: "MAX_ETHER", option: () => new ModifierTypeOption(modifierTypes.MAX_ETHER(), 0, 100) },
] as const;

it.each(etherCases)("validates move target mask for $itemId", ({ itemId, option }) => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  if (!bulbasaur) {
    throw new Error("Expected Bulbasaur in starter trio");
  }
  bulbasaur.getMoveset()[0]!.ppUsed = 1;

  const moveTargets = buildMoveTargetSnapshot(option(), bulbasaur);
  expect(moveTargets[0]?.available).toBe(true);
  moveTargets.slice(1).forEach(target => expect(target.available).toBe(false));
  recordValidatedItem(itemId, "move", "nur Moves mit fehlender PP duerfen gewaehlt werden");
});

const ppUpCases = [
  { itemId: "PP_UP", option: () => new ModifierTypeOption(modifierTypes.PP_UP(), 0, 100) },
  { itemId: "PP_MAX", option: () => new ModifierTypeOption(modifierTypes.PP_MAX(), 0, 100) },
] as const;

it.each(ppUpCases)("validates move target mask for $itemId", ({ itemId, option }) => {
  const party = initStarterScene();
  const bulbasaur = party[0];
  if (!bulbasaur) {
    throw new Error("Expected Bulbasaur in starter trio");
  }

  const moveset = bulbasaur.getMoveset();
  moveset[0]!.ppUp = 0;
  if (moveset[1]) {
    moveset[1].ppUp = 3;
  }

  const moveTargets = buildMoveTargetSnapshot(option(), bulbasaur);
  expect(moveTargets[0]?.available).toBe(true);
  if (moveTargets[1]) {
    expect(moveTargets[1].available).toBe(false);
  }
  recordValidatedItem(itemId, "move", "nur Moves mit PP>=5 und noch nicht vollem PP-Up duerfen gewaehlt werden");
});

it("writes validated item summary", () => {
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
  expect(validatedItems.length).toBeGreaterThan(0);
});

it.skip("TODO: validate target handling for MEMORY_MUSHROOM after deterministic relearn setup is added", () => {});
it.skip("TODO: validate target and move replacement flow for TM_COMMON", () => {});
it.skip("TODO: validate target and move replacement flow for TM_GREAT", () => {});
it.skip("TODO: validate target and move replacement flow for TM_ULTRA", () => {});
it.skip("Covered by dedicated rl:test:modifier:tera-shard-mask; excluded-species target coverage remains open", () => {});
it.skip("TODO: validate target handling for EVOLUTION_ITEM with guaranteed species/item matchup", () => {});
it.skip("TODO: validate target handling for RARE_EVOLUTION_ITEM with guaranteed species/item matchup", () => {});
it.skip("TODO: validate target handling for FORM_CHANGE_ITEM with guaranteed species/form setup", () => {});
it.skip("TODO: validate target handling for RARE_FORM_CHANGE_ITEM with guaranteed species/form setup", () => {});
it.skip("TODO: validate two-target flow for FusePokemonModifierType", () => {});
it.skip("TODO: validate held-item stack handling for REVIVER_SEED", () => {});
it.skip("TODO: validate held-item stack handling for WHITE_HERB", () => {});
it.skip("TODO: validate held-item stack handling for MYSTICAL_ROCK", () => {});
it.skip("TODO: validate held-item stack handling for ATTACK_TYPE_BOOSTER", () => {});
it.skip("TODO: validate held-item stack handling for SPECIES_STAT_BOOSTER", () => {});
it.skip("TODO: validate held-item stack handling for RARE_SPECIES_STAT_BOOSTER", () => {});
it.skip("TODO: validate held-item stack handling for BASE_STAT_BOOSTER", () => {});
