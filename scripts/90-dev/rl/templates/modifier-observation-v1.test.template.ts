import type { BattleScene } from "#app/battle-scene";
import {
  buildModifierObservation,
  type ModifierCandidate,
  type ModifierObservation,
  type ModifierObservationInput,
} from "#bot-ts/modifier-observation";
import { modifierTypes } from "#data/data-lists";
import { BerryType } from "#enums/berry-type";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { Stat } from "#enums/stat";
import type { BerryModifier, PersistentModifier } from "#modifiers/modifier";
import { ModifierTypeOption } from "#modifiers/modifier-type";
import { generateModifierType } from "#mystery-encounters/encounter-phase-utils";
import { SelectModifierPhase } from "#phases/select-modifier-phase";
import { GameManager } from "#test/framework/game-manager";
import { initSceneWithoutEncounterPhase } from "#test/utils/game-manager-utils";
import { ModifierSelectUiHandler } from "#ui/modifier-select-ui-handler";
import Phaser from "phaser";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, expect, it } from "vitest";

// Spieltest fuer den gemeinsamen modifier-v1-Builder (src/main/ts/lib/modifier-observation.ts).
// Der Runner validiert die geschriebenen Observations anschliessend gegen docs/rl-schema/modifier-transition-v1.schema.json.

const OUTPUT_PATH = __OUTPUT_PATH__;
const CANDY_JAR_STACKS = 2;

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

async function addGlobalModifier(modifier: PersistentModifier | null | undefined): Promise<void> {
  if (!modifier) {
    throw new Error("Failed to create modifier");
  }
  scene.addModifier(modifier, true, false, false, true);
  await scene.updateModifiers(true);
}

function findCandidates(observation: ModifierObservation, predicate: (c: ModifierCandidate) => boolean): ModifierCandidate[] {
  return observation.candidates.filter(predicate);
}

beforeAll(() => {
  phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
});

beforeEach(() => {
  game = new GameManager(phaserGame);
  scene = game.scene;
});

it("builds modifier-v1 state and candidates from a real SelectModifierPhase", async () => {
  initSceneWithoutEncounterPhase(scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);
  const party = scene.getPlayerParty();
  const [bulbasaur, charmander, squirtle] = party;
  if (!bulbasaur || !charmander || !squirtle) {
    throw new Error("Expected three party members");
  }

  bulbasaur.tryPopulateMoveset([MoveId.TACKLE, MoveId.GROWL, MoveId.VINE_WHIP]);
  charmander.tryPopulateMoveset([MoveId.SCRATCH, MoveId.GROWL, MoveId.EMBER]);
  squirtle.tryPopulateMoveset([MoveId.TACKLE, MoveId.TAIL_WHIP, MoveId.WATER_GUN]);

  // Party-Zustand: Bulbasaur hat PP verbraucht, Charmander ist verletzt, Squirtle besiegt.
  bulbasaur.getMoveset()[0]!.ppUsed = 5;
  charmander.hp = Math.max(1, Math.floor(charmander.getMaxHp() / 2));
  squirtle.hp = 0;

  // Vorhandene Items: Sonderbonbon-Glas (global, 2 Stacks), X-Angriff und Lockmittel (zeitlich begrenzt), Beere voll gestapelt.
  // generateModifierType setzt wie der Pool die Item-ID (withIdFromFunc).
  const candyJar = generateModifierType(modifierTypes.CANDY_JAR)?.newModifier() as PersistentModifier;
  candyJar.stackCount = CANDY_JAR_STACKS;
  await addGlobalModifier(candyJar);
  await addGlobalModifier(generateModifierType(modifierTypes.TEMP_STAT_STAGE_BOOSTER, [Stat.ATK])?.newModifier() as PersistentModifier);
  await addGlobalModifier(generateModifierType(modifierTypes.LURE)?.newModifier() as PersistentModifier);
  const sitrusType = generateModifierType(modifierTypes.BERRY, [BerryType.SITRUS]);
  if (!sitrusType) {
    throw new Error("Failed to generate SITRUS berry");
  }
  const sitrus = sitrusType.newModifier(bulbasaur) as BerryModifier;
  sitrus.stackCount = sitrus.getMaxStackCount();
  await addGlobalModifier(sitrus);

  const rewards = [
    new ModifierTypeOption(generateModifierType(modifierTypes.RARE_CANDY)!, 0),
    new ModifierTypeOption(sitrusType, 0),
    new ModifierTypeOption(generateModifierType(modifierTypes.POKEBALL)!, 0),
    new ModifierTypeOption(generateModifierType(modifierTypes.ETHER)!, 0),
  ];
  scene.phaseManager.unshiftPhase(new SelectModifierPhase(0, undefined, { guaranteedModifierTypeOptions: rewards }));
  await game.phaseInterceptor.to("SelectModifierPhase");

  const phase = scene.phaseManager.getCurrentPhase() as SelectModifierPhase;
  const handler = getModifierSelectHandler();
  const baseInput: Omit<ModifierObservationInput, "decisionStage"> = {
    scene,
    rewardOptions: handler.options.map(option => option.modifierTypeOption),
    shopRows: handler.shopOptionsRows.map(row => row.map(option => option.modifierTypeOption)),
    rerollCost: phase.getRerollCost(scene.lockModifierTiers),
    rerollCount: 0,
    purchasesThisPhase: 0,
    blockCandidate: candidate => (candidate.item_id === "ETHER" ? "test_block" : null),
  };

  const rngBefore = Phaser.Math.RND.state();
  const reward = buildModifierObservation({ ...baseInput, decisionStage: "reward" });
  const shop = buildModifierObservation({ ...baseInput, decisionStage: "shop" });
  const rewardAgain = buildModifierObservation({ ...baseInput, decisionStage: "reward" });
  expect(Phaser.Math.RND.state()).toEqual(rngBefore);
  expect(rewardAgain).toEqual(reward);

  // State
  const { state } = reward;
  expect(state.party_slots).toHaveLength(6);
  expect(state.party_slots.map(slot => slot.present)).toEqual([1, 1, 1, 0, 0, 0]);
  expect(state.party_slots[2]?.fainted).toBe(1);
  expect(state.party_slots[1]?.hp_ratio).toBeGreaterThan(0);
  expect(state.party_slots[1]?.hp_ratio).toBeLessThan(1);
  expect(state.party_slots[0]?.base_stat_total).toBeGreaterThan(0);
  expect(state.party_slots[0]?.min_pp_ratio).toBeLessThan(1);
  const heldBerry = state.party_slots[0]?.held_items.find(item => item.item_id === "BERRY");
  expect(heldBerry?.variant.berry_type).toBe(BerryType.SITRUS);
  expect(heldBerry?.stacks).toBe(heldBerry?.max_stacks);

  const globalById = new Map(state.global_items.map(item => [item.item_id, item]));
  expect(globalById.get("CANDY_JAR")?.stacks).toBe(CANDY_JAR_STACKS);
  expect(globalById.get("CANDY_JAR")?.item_family).toBe("level_booster");
  expect(globalById.get("TEMP_STAT_STAGE_BOOSTER")?.variant.stat).toBe(Stat.ATK);
  expect(globalById.get("TEMP_STAT_STAGE_BOOSTER")?.battles_remaining).toBe(5);
  expect(globalById.get("LURE")?.battles_remaining).toBe(10);
  expect(state.global_items.some(item => item.item_id === "BERRY")).toBe(false);

  expect(state.offer.filter(item => item.source === "reward").map(item => item.item_id)).toEqual([
    "RARE_CANDY",
    "BERRY",
    "POKEBALL",
    "ETHER",
  ]);
  expect(shop.state.offer).toEqual(state.offer);
  expect(state.run.wave_index).toBe(scene.currentBattle.waveIndex);
  expect(state.run.waves_until_next_boss).toBe(10 - (scene.currentBattle.waveIndex % 10));

  // Kandidaten der Gratis-Wahl
  const candy = findCandidates(reward, c => c.item_id === "RARE_CANDY");
  expect(candy.map(c => c.target_party_index)).toEqual([0, 1, 2]);
  expect(candy.every(c => c.effect?.level_gain === 1 + CANDY_JAR_STACKS)).toBe(true);

  const berryOnBulbasaur = findCandidates(reward, c => c.item_id === "BERRY" && c.target_party_index === 0)[0];
  expect(berryOnBulbasaur?.mask).toBe(0);
  expect(berryOnBulbasaur?.mask_reason).toMatch(/^select_filter:\S/);
  expect(berryOnBulbasaur?.owned_stacks).toBe(heldBerry?.stacks);
  expect(berryOnBulbasaur?.owned_max_stacks).toBe(heldBerry?.max_stacks);
  const berryOnCharmander = findCandidates(reward, c => c.item_id === "BERRY" && c.target_party_index === 1)[0];
  expect(berryOnCharmander?.mask).toBe(1);
  expect(berryOnCharmander?.owned_stacks).toBe(0);

  const ball = findCandidates(reward, c => c.item_id === "POKEBALL");
  expect(ball).toHaveLength(1);
  expect(ball[0]?.target_party_index).toBeUndefined();
  expect(ball[0]?.mask).toBe(1);
  expect(ball[0]?.variant).toEqual({ pokeball_type: 0, count: 5 });

  const ether = findCandidates(reward, c => c.item_id === "ETHER");
  expect(ether.some(c => c.target_move_index !== undefined)).toBe(true);
  // Bulbasaur, erste Attacke: im Spiel waehlbar, aber vom Aufrufer gesperrt.
  expect(ether.find(c => c.target_party_index === 0 && c.target_move_index === 0)?.mask_reason).toBe("test_block");

  const kinds = reward.candidates.map(c => c.kind);
  expect(kinds.slice(-3)).toEqual(["reroll", "toggle_lock_rarities", "skip"]);
  expect(reward.candidates.at(-1)?.mask_reason).toBe("skip_while_free_reward");
  expect(reward.candidates.find(c => c.kind === "toggle_lock_rarities")?.mask_reason).toBe("requires_lock_capsule");

  // Kandidaten der Shop-Stufe
  expect(shop.candidates.at(-1)).toEqual({ kind: "finish_shop", mask: 1, tier: -1, cost: 0 });
  expect(shop.candidates.slice(0, -1).every(c => c.kind === "buy_shop_item")).toBe(true);
  expect(shop.candidates.some(c => c.kind === "take_reward")).toBe(false);
  // Shop-Items haben im Spiel keine Pool-ID; der Builder liest sie aus dem localeKey.
  const shopIds = shop.state.offer.filter(item => item.source === "shop").map(item => item.item_id);
  expect(shopIds).toContain("POTION");
  expect(shop.state.offer.filter(item => item.source === "shop").every(item => item.item_family !== "other")).toBe(true);
  const potionOnCharmander = findCandidates(shop, c => c.item_id === "POTION" && c.target_party_index === 1)[0];
  expect(potionOnCharmander?.effect?.hp_restore_ratio).toBeGreaterThan(0);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({ observations: [reward, shop] }, null, 2), "utf8");
});
