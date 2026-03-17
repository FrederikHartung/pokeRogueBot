import type { BattleScene } from "#app/battle-scene";
import { modifierTypes } from "#data/data-lists";
import { SpeciesId } from "#enums/species-id";
import { FormChangeItem } from "#enums/form-change-item";
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
  const modifierType = option?.modifierTypeOption?.type ?? option?.type;
  if (modifierType?.constructor?.name === "FormChangeItemModifierType" && modifierType?.formChangeItem !== undefined) {
    return FormChangeItem[modifierType.formChangeItem] ?? "UNKNOWN";
  }
  return option?.modifierTypeOption?.type?.id ?? option?.type?.id ?? option?.modifierTypeOption?.type?.name ?? option?.type?.name ?? "UNKNOWN";
}

function getActionExecutability(option: any): { executable: boolean; reason?: string } {
  const modifierTypeId = getModifierTypeId(option);
  const modifierType = option?.modifierTypeOption?.type ?? option?.type;

  if (modifierType?.constructor?.name === "FormChangeItemModifierType") {
    return { executable: false, reason: "form_change_group2_todo" };
  }
  if (typeof modifierType?.selectFilter === "function") {
    return { executable: true };
  }
  return { executable: false, reason: "requires_followup_selection" };
}

const group2Items: FormChangeItem[] = [
  FormChangeItem.DARK_STONE,
  FormChangeItem.LIGHT_STONE,
  FormChangeItem.N_SOLARIZER,
  FormChangeItem.N_LUNARIZER,
  FormChangeItem.ULTRANECROZIUM_Z,
  FormChangeItem.ICY_REINS_OF_UNITY,
  FormChangeItem.SHADOW_REINS_OF_UNITY,
  FormChangeItem.FIST_PLATE,
  FormChangeItem.SKY_PLATE,
  FormChangeItem.TOXIC_PLATE,
  FormChangeItem.EARTH_PLATE,
  FormChangeItem.STONE_PLATE,
  FormChangeItem.INSECT_PLATE,
  FormChangeItem.SPOOKY_PLATE,
  FormChangeItem.IRON_PLATE,
  FormChangeItem.FLAME_PLATE,
  FormChangeItem.SPLASH_PLATE,
  FormChangeItem.MEADOW_PLATE,
  FormChangeItem.ZAP_PLATE,
  FormChangeItem.MIND_PLATE,
  FormChangeItem.ICICLE_PLATE,
  FormChangeItem.DRACO_PLATE,
  FormChangeItem.DREAD_PLATE,
  FormChangeItem.PIXIE_PLATE,
  FormChangeItem.BLANK_PLATE,
  FormChangeItem.LEGEND_PLATE,
  FormChangeItem.FIGHTING_MEMORY,
  FormChangeItem.FLYING_MEMORY,
  FormChangeItem.POISON_MEMORY,
  FormChangeItem.GROUND_MEMORY,
  FormChangeItem.ROCK_MEMORY,
  FormChangeItem.BUG_MEMORY,
  FormChangeItem.GHOST_MEMORY,
  FormChangeItem.STEEL_MEMORY,
  FormChangeItem.FIRE_MEMORY,
  FormChangeItem.WATER_MEMORY,
  FormChangeItem.GRASS_MEMORY,
  FormChangeItem.ELECTRIC_MEMORY,
  FormChangeItem.PSYCHIC_MEMORY,
  FormChangeItem.ICE_MEMORY,
  FormChangeItem.DRAGON_MEMORY,
  FormChangeItem.DARK_MEMORY,
  FormChangeItem.FAIRY_MEMORY,
  FormChangeItem.NORMAL_MEMORY,
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

it.each(group2Items)("filters group-2 form change item %s out of the action mask", async (item) => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

  const modifierType = modifierTypes.FORM_CHANGE_ITEM().generateType(scene.getPlayerParty(), [item]);
  if (!modifierType) {
    throw new Error(`Failed to generate form change item modifier for ${FormChangeItem[item]}`);
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

  const option = handler.options[0];
  const executability = getActionExecutability(option);
  const actionMask = [executability.executable ? 1 : 0];

  expect(modifierType.constructor.name).toBe("FormChangeItemModifierType");
  expect(getModifierTypeId(option)).toBe(FormChangeItem[item]);
  expect(executability).toEqual({
    executable: false,
    reason: "form_change_group2_todo",
  });
  expect(actionMask).toEqual([0]);

  validatedItems.push(FormChangeItem[item]);
});

it("writes group-2 form change mask validation summary", () => {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        validated_items: validatedItems,
        non_executable_reason: "form_change_group2_todo",
      },
      null,
      2,
    ),
    "utf8",
  );

  expect(validatedItems).toHaveLength(group2Items.length);
});
