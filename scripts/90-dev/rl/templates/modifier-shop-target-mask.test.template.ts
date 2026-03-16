import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesId } from "#enums/species-id";
import type { PlayerPokemon } from "#field/pokemon";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { GameManager } from "#test/test-utils/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/test-utils/game-manager-utils";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, expect, it } from "vitest";

type TargetSnapshot = {
  target_party_index: number;
  pokemon_name: string;
  hp: number;
  max_hp: number;
  fainted: boolean;
  available: boolean;
  unavailable_reason: string | null;
};

const OUTPUT_PATH = __OUTPUT_PATH__;

let phaserGame: Phaser.Game;
let game: GameManager;
let scene: BattleScene;

function buildTargetSnapshot(
  option: ModifierTypeOption,
  pokemon: PlayerPokemon,
  targetPartyIndex: number,
): TargetSnapshot {
  const filterResult = option.type.selectFilter ? option.type.selectFilter(pokemon) : null;
  return {
    target_party_index: targetPartyIndex,
    pokemon_name: pokemon.getNameToRender(),
    hp: pokemon.hp,
    max_hp: pokemon.getMaxHp(),
    fainted: pokemon.isFainted(),
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

it("masks potion and revive targets according to party state", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);
  const playerParty = scene.getPlayerParty();
  const bulbasaur = playerParty[0];
  const charmander = playerParty[1];
  const squirtle = playerParty[2];

  if (!bulbasaur || !charmander || !squirtle) {
    throw new Error("Expected starter trio in player party");
  }

  bulbasaur.hp = Math.max(1, bulbasaur.getMaxHp() - 3);
  charmander.hp = 0;
  squirtle.hp = squirtle.getMaxHp();

  const potionOption = new ModifierTypeOption(modifierTypes.POTION(), 0, 100);
  const reviveOption = new ModifierTypeOption(modifierTypes.REVIVE(), 0, 500);

  const potionTargets = playerParty.map((pokemon, targetPartyIndex) =>
    buildTargetSnapshot(potionOption, pokemon, targetPartyIndex),
  );
  const reviveTargets = playerParty.map((pokemon, targetPartyIndex) =>
    buildTargetSnapshot(reviveOption, pokemon, targetPartyIndex),
  );

  expect(potionTargets[0]?.available).toBe(true);
  expect(potionTargets[1]?.available).toBe(false);
  expect(potionTargets[2]?.available).toBe(false);

  expect(reviveTargets[0]?.available).toBe(false);
  expect(reviveTargets[1]?.available).toBe(true);
  expect(reviveTargets[2]?.available).toBe(false);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        potion_targets: potionTargets,
        revive_targets: reviveTargets,
      },
      null,
      2,
    ),
    "utf8",
  );
});
