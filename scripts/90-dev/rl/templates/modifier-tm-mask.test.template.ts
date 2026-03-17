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

function getModifierSelectHandler(): ModifierSelectUiHandler {
  const handler = scene.ui.handlers.find(candidate => candidate instanceof ModifierSelectUiHandler);
  if (!(handler instanceof ModifierSelectUiHandler)) {
    throw new Error("ModifierSelectUiHandler not found");
  }
  return handler;
}

function getModifierTypeId(option: any): string {
  return option?.modifierTypeOption?.type?.id ?? option?.type?.id ?? option?.modifierTypeOption?.type?.name ?? option?.type?.name ?? "UNKNOWN";
}

function getActionExecutability(option: any): { executable: boolean; reason?: string } {
  const modifierTypeId = getModifierTypeId(option);
  const modifierType = option?.modifierTypeOption?.type ?? option?.type;

  if (String(modifierTypeId).startsWith("TM") || modifierType?.constructor?.name === "TmModifierTypeGenerator") {
    return { executable: false, reason: "tm_selection_todo" };
  }
  if (typeof modifierType?.moveSelectFilter === "function") {
    return { executable: false, reason: "requires_move_selection" };
  }
  if (typeof modifierType?.selectFilter === "function") {
    return { executable: true };
  }
  return { executable: false, reason: "requires_followup_selection" };
}

const tmCases = [
  { name: "TM_COMMON", factory: () => modifierTypes.TM_COMMON() },
  { name: "TM_GREAT", factory: () => modifierTypes.TM_GREAT() },
  { name: "TM_ULTRA", factory: () => modifierTypes.TM_ULTRA() },
];

const validatedItems: string[] = [];

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

it.each(tmCases)("filters $name out of the action mask until learn-move support exists", async ({ name, factory }) => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const forcedReward = new ModifierTypeOption(factory(), 0);
  scene.phaseManager.unshiftPhase(
    new SelectModifierPhase(0, undefined, {
      guaranteedModifierTypeOptions: [forcedReward],
    }),
  );
  await game.phaseInterceptor.to("SelectModifierPhase");

  const handler = getModifierSelectHandler();
  expect(handler.options.length).toBeGreaterThanOrEqual(1);

  const option = handler.options[0];
  const executability = getActionExecutability(option);
  const actionMask = [executability.executable ? 1 : 0];

  expect(forcedReward.type.constructor.name).toBe("TmModifierTypeGenerator");
  expect(executability).toEqual({
    executable: false,
    reason: "tm_selection_todo",
  });
  expect(actionMask).toEqual([0]);

  validatedItems.push(name);
});

it("writes TM mask validation summary", () => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_items: validatedItems,
        non_executable_reason: "tm_selection_todo",
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedItems).toEqual(["TM_COMMON", "TM_GREAT", "TM_ULTRA"]);
});
