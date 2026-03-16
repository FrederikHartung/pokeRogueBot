import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { BerryType } from "#enums/berry-type";
import { SpeciesId } from "#enums/species-id";
import type { PlayerPokemon } from "#field/pokemon";
import type { BerryModifier } from "#modifiers/modifier";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { SelectModifierPhase } from "#phases/select-modifier-phase";
import { generateModifierType } from "#mystery-encounters/encounter-phase-utils";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, expect, it } from "vitest";

type TargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  matching_stack_count: number;
  max_stack_count: number;
  available: boolean;
  unavailable_reason: string | null;
};

const OUTPUT_PATH = __OUTPUT_PATH__;

let phaserGame: Phaser.Game;
let game: GameManager;
let scene: BattleScene;

function getModifierSelectHandler(): ModifierSelectUiHandler {
  const handler = scene.ui.handlers.find(
    candidate => candidate instanceof ModifierSelectUiHandler,
  );
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function getTargetSnapshot(playerPokemon: PlayerPokemon, rewardOption: ModifierTypeOption, partyIndex: number): TargetSnapshot {
  const rewardModifier = rewardOption.type.newModifier(playerPokemon) as BerryModifier;
  const matchingModifier = scene.findModifier(
    modifier =>
      modifier instanceof rewardModifier.constructor
      && "pokemonId" in modifier
      && modifier.pokemonId === playerPokemon.id
      && "matchType" in modifier
      && typeof modifier.matchType === "function"
      && modifier.matchType(rewardModifier),
  ) as BerryModifier | undefined;
  const selectFilter = rewardOption.type.selectFilter;
  const filterResult = selectFilter ? selectFilter(playerPokemon) : null;

  return {
    target_party_index: partyIndex,
    pokemon_name: playerPokemon.getNameToRender(),
    matching_stack_count: matchingModifier?.stackCount ?? 0,
    max_stack_count: rewardModifier.getMaxStackCount(),
    available: !filterResult,
    unavailable_reason: filterResult,
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

it("masks berry targets that already reached the per-type stack limit", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const playerParty = scene.getPlayerParty();
  const fullStackTarget = playerParty[0];
  if (!fullStackTarget) {
    throw new Error("Expected player party to contain Bulbasaur");
  }

  const sitrusModifierType = generateModifierType(modifierTypes.BERRY, [BerryType.SITRUS]);
  if (!sitrusModifierType) {
    throw new Error("Failed to generate SITRUS berry modifier type");
  }

  const existingSitrusModifier = sitrusModifierType.newModifier(fullStackTarget) as BerryModifier;
  existingSitrusModifier.stackCount = existingSitrusModifier.getMaxStackCount();
  scene.addModifier(existingSitrusModifier, true, false, false, true);
  await scene.updateModifiers(true);

  const forcedReward = new ModifierTypeOption(sitrusModifierType, 0);
  const selectModifierPhase = new SelectModifierPhase(0, undefined, {
    guaranteedModifierTypeOptions: [forcedReward],
  });

  scene.phaseManager.unshiftPhase(selectModifierPhase);
  await game.phaseInterceptor.to("SelectModifierPhase");

  const handler = getModifierSelectHandler();
  expect(handler.options.length).toBeGreaterThanOrEqual(1);

  const berryOption = handler.options[0]?.modifierTypeOption;
  expect(berryOption?.type.id).toEqual("BERRY");

  const targets = playerParty.map((pokemon, partyIndex) => getTargetSnapshot(pokemon, berryOption, partyIndex));

  expect(targets).toHaveLength(3);
  expect(targets[0]?.available).toBe(false);
  expect(targets[0]?.matching_stack_count).toEqual(targets[0]?.max_stack_count);
  expect(targets[0]?.unavailable_reason).toBeTruthy();
  expect(targets[1]?.available).toBe(true);
  expect(targets[2]?.available).toBe(true);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        reward_modifier_id: berryOption.type.id,
        reward_modifier_name: berryOption.type.name,
        berry_type: BerryType.SITRUS,
        targets,
      },
      null,
      2,
    ),
    "utf8",
  );
});
