// Statische Item-Regeln des strategischen Modifier-Collectors: welche Reward- und Shop-Items er ausfuehren kann.
//
// Ergaenzt die Spielregeln des modifier-v1-Builders (modifier-observation.ts) um das, was die Ausfuehrung im Collector
// (noch) nicht beherrscht oder bewusst sperrt. Genutzt vom Collector-Template (createCollectorCandidateBlocker) und von
// der Item-Suite, die daraus die Spalte "im Strategic Collector ausfuehrbar" in
// docs/select-modifier-shop-item-matrix.md prueft. Zielabhaengige Regeln (STAB, Species-Booster) brauchen den
// Spielzustand und bleiben im Template. Keine Laufzeit-Imports aus dem Submodul; die Runner kopieren die Datei neben den
// generierten Test und ersetzen den Import "#bot-ts/modifier-collector-policy".
import { FormChangeItem } from "#enums/form-change-item";

/** Strukturelle Sicht auf ModifierType: Fake-Optionen in den Collector-Tests haben nur diese Felder. */
export interface PolicyModifierType {
  id?: string;
  name?: string;
  localeKey?: string;
  constructor: { name: string };
  selectFilter?: unknown;
  moveSelectFilter?: unknown;
  /** Nur FormChangeItemModifierType: das konkrete Item; die id ist die des Pools (FORM_CHANGE_ITEM bzw. RARE_...). */
  formChangeItem?: FormChangeItem;
}

/** Form des UI-Objekts (ModifierOption) bzw. eines `{ modifierTypeOption }`-Wrappers. */
export interface PolicyOption {
  modifierTypeOption?: { type?: PolicyModifierType } | null;
}

export type CollectorActionType = "take_reward" | "buy_shop_item";

export interface CollectorExecutability {
  executable: boolean;
  reason?: string;
  requiresPartyTarget?: boolean;
  /** Nach dem Party-Ziel folgt eine Attacken-Auswahl (PartyUiMode.MOVE_MODIFIER). */
  requiresMoveTarget?: boolean;
}

// Reward actions are either:
// - explicitly blocked for the current offline DQN setup,
// - allowed as direct no-target actions,
// - allowed as party-target actions via selectFilter-based target masking,
// - or still unsupported because they require move/multi-step follow-up selection.
export const OFFLINE_BLOCKED_REWARD_IDS = new Set([
  "MAP",
  "MEMORY_MUSHROOM",
  "DNA_SPLICERS",
  "TERA_SHARD",
  "TERA_ORB",
  "MEGA_BRACELET",
  "DYNAMAX_BAND",
  "LOCK_CAPSULE",
  "VOUCHER",
  "VOUCHER_PLUS",
  "VOUCHER_PREMIUM",
  "IV_SCANNER",
  "SHINY_CHARM",
  "HEALING_CHARM",
  "ABILITY_CHARM",
  "CATCHING_CHARM",
  "EVIOLITE",
  "LEEK",
  "TOXIC_ORB",
  "FLAME_ORB",
  "BATON",
  "SOUL_DEW",
]);
export const OFFLINE_ALLOWED_DIRECT_REWARD_IDS = new Set([
  "LURE",
  "SUPER_LURE",
  "MAX_LURE",
  "POKEBALL",
  "GREAT_BALL",
  "ULTRA_BALL",
  "ROGUE_BALL",
  "MASTER_BALL",
  "BERRY",
  "SACRED_ASH",
  "RARER_CANDY",
  "TEMP_STAT_STAGE_BOOSTER",
  "DIRE_HIT",
  "NUGGET",
  "BIG_NUGGET",
  "RELIC_GOLD",
  "AMULET_COIN",
  "CANDY_JAR",
  "EXP_CHARM",
  "SUPER_EXP_CHARM",
  "EXP_SHARE",
  "BERRY_POUCH",
]);
export const BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS = new Set([
  "DARK_STONE",
  "LIGHT_STONE",
  "N_SOLARIZER",
  "N_LUNARIZER",
  "ULTRANECROZIUM_Z",
  "ICY_REINS_OF_UNITY",
  "SHADOW_REINS_OF_UNITY",
  "FIST_PLATE",
  "SKY_PLATE",
  "TOXIC_PLATE",
  "EARTH_PLATE",
  "STONE_PLATE",
  "INSECT_PLATE",
  "SPOOKY_PLATE",
  "IRON_PLATE",
  "FLAME_PLATE",
  "SPLASH_PLATE",
  "MEADOW_PLATE",
  "ZAP_PLATE",
  "MIND_PLATE",
  "ICICLE_PLATE",
  "DRACO_PLATE",
  "DREAD_PLATE",
  "PIXIE_PLATE",
  "BLANK_PLATE",
  "LEGEND_PLATE",
  "FIGHTING_MEMORY",
  "FLYING_MEMORY",
  "POISON_MEMORY",
  "GROUND_MEMORY",
  "ROCK_MEMORY",
  "BUG_MEMORY",
  "GHOST_MEMORY",
  "STEEL_MEMORY",
  "FIRE_MEMORY",
  "WATER_MEMORY",
  "GRASS_MEMORY",
  "ELECTRIC_MEMORY",
  "PSYCHIC_MEMORY",
  "ICE_MEMORY",
  "DRAGON_MEMORY",
  "DARK_MEMORY",
  "FAIRY_MEMORY",
  "NORMAL_MEMORY",
]);
export const OFFLINE_BLOCKED_MODIFIER_TYPE_NAMES = new Set([
  "RememberMoveModifierType",
  "TerastallizeModifierType",
  "FusePokemonModifierType",
]);

/**
 * Belohnungen mit Attacken-Ziel, die der Collector ausfuehrt (Party-Slot, dann Attacke). TMs und Erinnerungspilz fuehren
 * stattdessen in eine Lern-Entscheidung und bleiben bis zur Learn-Move-Policy gesperrt (docs/modifier-state-v1-draft.md 2.3).
 */
export const MOVE_TARGET_REWARD_IDS = new Set(["ETHER", "MAX_ETHER", "PP_UP", "PP_MAX"]);

const LOCALE_KEY_ID = /^modifierType:ModifierType\.([A-Z0-9_]+)$/;

/** Wie itemIdOf im Builder; Shop-Items haben keine Pool-id, ihr localeKey traegt den Schluessel. */
export function getModifierTypeId(option: PolicyOption | null | undefined): string {
  const modifierType = option?.modifierTypeOption?.type;
  if (!modifierType) return "unknown";
  return (
    modifierType.id
    ?? LOCALE_KEY_ID.exec(modifierType.localeKey ?? "")?.[1]
    ?? modifierType.name
    ?? modifierType.constructor?.name
    ?? "unknown"
  );
}

export function normalizeModifierTypeId(modifierTypeId?: string | null): string {
  return String(modifierTypeId ?? "").trim().toUpperCase().replaceAll(" ", "_");
}

const HP_RESTORE_SHOP_IDS = new Set(["POTION", "SUPER_POTION", "HYPER_POTION", "MAX_POTION", "FULL_RESTORE"]);
const REVIVE_SHOP_IDS = new Set(["REVIVE", "MAX_REVIVE"]);

export function isSupportedHpRestoreShopItem(modifierTypeId: string): boolean {
  return HP_RESTORE_SHOP_IDS.has(normalizeModifierTypeId(modifierTypeId));
}

export function isSupportedStatusHealShopItem(modifierTypeId: string): boolean {
  return normalizeModifierTypeId(modifierTypeId) === "FULL_HEAL";
}

export function isSupportedReviveShopItem(modifierTypeId: string): boolean {
  return REVIVE_SHOP_IDS.has(normalizeModifierTypeId(modifierTypeId));
}

export function isSupportedDirectShopItem(modifierTypeId: string): boolean {
  return normalizeModifierTypeId(modifierTypeId) === "SACRED_ASH";
}

/** Die Pool-id ist fuer alle Formwechsel-Items gleich; entscheidend ist das konkrete Item. */
function isBlockedGroup2FormChangeItem(modifierType: PolicyModifierType | undefined, normalizedModifierTypeId: string): boolean {
  const formChangeItem = modifierType?.formChangeItem;
  const itemName = formChangeItem === undefined ? undefined : FormChangeItem[formChangeItem];
  return (
    BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS.has(normalizedModifierTypeId)
    || (itemName !== undefined && BLOCKED_GROUP2_FORM_CHANGE_ITEM_IDS.has(itemName))
  );
}

export function getActionExecutability(
  actionType: CollectorActionType,
  option: PolicyOption | null | undefined,
): CollectorExecutability {
  const modifierTypeId = getModifierTypeId(option);
  const normalizedModifierTypeId = normalizeModifierTypeId(modifierTypeId);
  const modifierType = option?.modifierTypeOption?.type;
  const modifierTypeName = modifierType?.constructor?.name ?? "";
  if (actionType === "take_reward") {
    if (normalizedModifierTypeId === "MEMORY_MUSHROOM" || modifierTypeName === "RememberMoveModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:remember_move_todo" };
    }
    if (normalizedModifierTypeId === "TERA_SHARD" || modifierTypeName === "TerastallizeModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:tera_shard_todo" };
    }
    if (normalizedModifierTypeId === "DNA_SPLICERS" || modifierTypeName === "FusePokemonModifierType") {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:fuse_todo" };
    }
    if (modifierTypeName === "FormChangeItemModifierType" && isBlockedGroup2FormChangeItem(modifierType, normalizedModifierTypeId)) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:form_change_group2_todo" };
    }
    if (normalizedModifierTypeId.startsWith("TM")) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy:tm_selection_todo" };
    }
    if (
      OFFLINE_BLOCKED_REWARD_IDS.has(normalizedModifierTypeId)
      || OFFLINE_BLOCKED_MODIFIER_TYPE_NAMES.has(modifierTypeName)
    ) {
      return { executable: false, reason: "blocked_by_offline_modifier_policy" };
    }
    if (typeof modifierType?.moveSelectFilter === "function") {
      if (MOVE_TARGET_REWARD_IDS.has(normalizedModifierTypeId)) {
        return { executable: true, requiresPartyTarget: true, requiresMoveTarget: true };
      }
      return { executable: false, reason: "requires_move_selection" };
    }
    if (typeof modifierType?.selectFilter === "function") {
      return { executable: true, requiresPartyTarget: true };
    }
    if (OFFLINE_ALLOWED_DIRECT_REWARD_IDS.has(normalizedModifierTypeId)) {
      return { executable: true };
    }
    return { executable: false, reason: "requires_followup_selection" };
  }

  if (
    (isSupportedHpRestoreShopItem(modifierTypeId)
      || isSupportedStatusHealShopItem(modifierTypeId)
      || isSupportedReviveShopItem(modifierTypeId))
    && typeof modifierType?.selectFilter === "function"
  ) {
    return { executable: true, requiresPartyTarget: true };
  }
  if (isSupportedDirectShopItem(modifierTypeId)) {
    return { executable: true };
  }

  return { executable: false, reason: "shop_item_execution_not_implemented" };
}

