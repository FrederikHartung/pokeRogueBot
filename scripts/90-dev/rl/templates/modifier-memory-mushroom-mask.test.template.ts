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

  if (modifierTypeId === "MEMORY_MUSHROOM" || modifierType?.constructor?.name === "RememberMoveModifierType") {
    return { executable: false, reason: "remember_move_todo" };
  }
  if (String(modifierTypeId).startsWith("TM")) {
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

it("filters MEMORY_MUSHROOM out of the action mask as a deferred follow-up item", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const forcedReward = new ModifierTypeOption(modifierTypes.MEMORY_MUSHROOM(), 0);
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

  expect(forcedReward.type.constructor.name).toBe("RememberMoveModifierType");
  expect(executability).toEqual({
    executable: false,
    reason: "remember_move_todo",
  });
  expect(actionMask).toEqual([0]);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        modifier_type_id: getModifierTypeId(option),
        executable: executability.executable,
        non_executable_reason: executability.reason ?? null,
        action_mask: actionMask,
      },
      null,
      2,
    ),
    "utf8",
  );
});
