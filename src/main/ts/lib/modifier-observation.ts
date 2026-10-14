// Modifier-Observation fuer den modifier-v1-Contract (docs/rl-schema/modifier-transition-v1.schema.json).
//
// Einzige Implementierung von State und Kandidaten der SelectModifierPhase: der strategische Modifier-Collector und
// spaeter die JS-Bridge des Live-Bots rufen dieselbe Funktion auf. Wie combat-observation.ts nur Typ-Importe aus dem
// Submodul plus reine Enum-Dateien; die Collector-Runner kopieren diese Datei (und combat-observation.ts) neben den
// generierten Test und ersetzen den Import "#bot-ts/modifier-observation".
//
// Der Builder darf den Spiel-Zufall nicht beruehren, sonst aendert er den Run. Deshalb kein gameMode.isWaveTrainer
// (wuerfelt mit dem Spiel-RNG) und kein newModifier() auf angebotenen Items.
import type { BattleScene } from "#app/battle-scene";
import type { PlayerPokemon, Pokemon } from "#field/pokemon";
import type { PersistentModifier } from "#modifiers/modifier";
import type { ModifierType, ModifierTypeOption } from "#modifiers/modifier-type";
import type { PokemonMove } from "#moves/pokemon-move";
import { PokeballType } from "#enums/pokeball";
import { getHpRatio, statusOf, typesOf } from "./combat-observation";

export const MODIFIER_STATE_SCHEMA_VERSION = "modifier-v1";
export const PARTY_SLOTS = 6;
const WAVE_LOOKAHEAD_CAP = 30;
const MAX_PARTY_LUCK = 14;

export type DecisionStage = "shop" | "reward";
export type CandidateKind =
  | "buy_shop_item"
  | "finish_shop"
  | "take_reward"
  | "reroll"
  | "toggle_lock_rarities"
  | "skip";

export type ItemFamily =
  | "heal_hp"
  | "heal_status"
  | "revive"
  | "revive_all"
  | "pp_restore"
  | "pp_up"
  | "level_up"
  | "level_up_all"
  | "base_stat_booster"
  | "temp_battle_booster"
  | "attack_type_booster"
  | "held_item"
  | "berry"
  | "evolution"
  | "form_change"
  | "nature"
  | "tm"
  | "remember_move"
  | "ball"
  | "lure"
  | "money"
  | "money_multiplier"
  | "exp_booster"
  | "exp_share"
  | "level_booster"
  | "berry_pouch"
  | "charm"
  | "voucher"
  | "battle_gimmick"
  | "lock_capsule"
  | "map"
  | "fusion"
  | "iv_scanner"
  | "extra_reward"
  | "other";

export type ItemVariant = Record<string, number>;

export interface OwnedItem {
  item_id: string;
  item_family: ItemFamily;
  variant: ItemVariant;
  tier: number;
  stacks: number;
  max_stacks: number;
  battles_remaining?: number;
  max_battles?: number;
}

export interface OfferItem {
  source: "reward" | "shop";
  reward_index?: number;
  shop_row_index?: number;
  shop_column_index?: number;
  item_id: string;
  item_family: ItemFamily;
  variant: ItemVariant;
  tier: number;
  upgrade_count: number;
  cost: number;
}

export interface GoalProfile {
  w_run: number;
  w_meta: number;
}

export interface RunContext {
  wave_index: number;
  money: number;
  reroll_cost: number;
  reroll_count: number;
  lock_rarities: number;
  shop_available: number;
  purchases_this_phase: number;
  waves_until_next_fixed_battle: number;
  waves_until_next_boss: number;
  party_luck: number;
  goal_profile: GoalProfile;
}

export interface PartySlot {
  present: number;
  fainted: number;
  hp_ratio: number;
  level: number;
  level_ratio_to_cap: number;
  status: number;
  types: number[];
  base_stat_total: number;
  move_count: number;
  min_pp_ratio: number;
  held_items: OwnedItem[];
}

export interface ModifierState {
  run: RunContext;
  party_slots: PartySlot[];
  global_items: OwnedItem[];
  inventory: { pokeball_counts: number[] };
  offer: OfferItem[];
}

export interface CandidateEffect {
  hp_restore_ratio?: number;
  level_gain?: number;
  stab_match?: number;
}

export interface ModifierCandidate {
  kind: CandidateKind;
  mask: number;
  mask_reason?: string;
  reward_index?: number;
  shop_row_index?: number;
  shop_column_index?: number;
  item_id?: string;
  item_family?: ItemFamily;
  variant?: ItemVariant;
  tier: number;
  upgrade_count?: number;
  cost: number;
  target_party_index?: number;
  target_move_index?: number;
  owned_stacks?: number;
  owned_max_stacks?: number;
  effect?: CandidateEffect;
}

export interface ModifierObservation {
  schema_version: typeof MODIFIER_STATE_SCHEMA_VERSION;
  decision_stage: DecisionStage;
  state: ModifierState;
  candidates: ModifierCandidate[];
}

/**
 * Zusaetzliche Sperre des Aufrufers, z. B. "Collector kann TMs noch nicht ausfuehren". Gibt einen Grund oder null
 * zurueck. Wird nicht fuer skip und finish_shop gefragt: beide sind immer ausfuehrbar.
 */
export type CandidateBlocker = (candidate: ModifierCandidate, option: ModifierTypeOption | null) => string | null;

export interface ModifierObservationInput {
  scene: BattleScene;
  decisionStage: DecisionStage;
  /** Gratis-Belohnungen in Anzeigereihenfolge (ModifierSelectUiHandler.options[i].modifierTypeOption). */
  rewardOptions: readonly ModifierTypeOption[];
  /** Shop-Reihen; Reihen- und Spaltenindex werden unveraendert in Angebot und Kandidaten uebernommen. */
  shopRows: readonly (readonly ModifierTypeOption[])[];
  /** SelectModifierPhase.getRerollCost(scene.lockModifierTiers); -1, wenn Reroll deaktiviert ist. */
  rerollCost: number;
  rerollCount: number;
  purchasesThisPhase: number;
  goalProfile?: GoalProfile;
  blockCandidate?: CandidateBlocker;
}

// ---------------------------------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------------------------------

const FAMILY_BY_ID: Readonly<Record<string, ItemFamily>> = {
  POTION: "heal_hp",
  SUPER_POTION: "heal_hp",
  HYPER_POTION: "heal_hp",
  MAX_POTION: "heal_hp",
  FULL_RESTORE: "heal_hp",
  FULL_HEAL: "heal_status",
  REVIVE: "revive",
  MAX_REVIVE: "revive",
  SACRED_ASH: "revive_all",
  ETHER: "pp_restore",
  MAX_ETHER: "pp_restore",
  ELIXIR: "pp_restore",
  MAX_ELIXIR: "pp_restore",
  PP_UP: "pp_up",
  PP_MAX: "pp_up",
  RARE_CANDY: "level_up",
  RARER_CANDY: "level_up_all",
  BASE_STAT_BOOSTER: "base_stat_booster",
  TEMP_STAT_STAGE_BOOSTER: "temp_battle_booster",
  DIRE_HIT: "temp_battle_booster",
  ATTACK_TYPE_BOOSTER: "attack_type_booster",
  BERRY: "berry",
  EVOLUTION_ITEM: "evolution",
  RARE_EVOLUTION_ITEM: "evolution",
  FORM_CHANGE_ITEM: "form_change",
  RARE_FORM_CHANGE_ITEM: "form_change",
  MINT: "nature",
  TM_COMMON: "tm",
  TM_GREAT: "tm",
  TM_ULTRA: "tm",
  MEMORY_MUSHROOM: "remember_move",
  POKEBALL: "ball",
  GREAT_BALL: "ball",
  ULTRA_BALL: "ball",
  ROGUE_BALL: "ball",
  MASTER_BALL: "ball",
  LURE: "lure",
  SUPER_LURE: "lure",
  MAX_LURE: "lure",
  NUGGET: "money",
  BIG_NUGGET: "money",
  RELIC_GOLD: "money",
  AMULET_COIN: "money_multiplier",
  COIN_CASE: "money_multiplier",
  EXP_CHARM: "exp_booster",
  SUPER_EXP_CHARM: "exp_booster",
  GOLDEN_EXP_CHARM: "exp_booster",
  LUCKY_EGG: "exp_booster",
  GOLDEN_EGG: "exp_booster",
  EXP_SHARE: "exp_share",
  EXP_BALANCE: "exp_share",
  CANDY_JAR: "level_booster",
  BERRY_POUCH: "berry_pouch",
  HEALING_CHARM: "charm",
  SHINY_CHARM: "charm",
  ABILITY_CHARM: "charm",
  CATCHING_CHARM: "charm",
  OVAL_CHARM: "charm",
  VOUCHER: "voucher",
  VOUCHER_PLUS: "voucher",
  VOUCHER_PREMIUM: "voucher",
  MEGA_BRACELET: "battle_gimmick",
  DYNAMAX_BAND: "battle_gimmick",
  TERA_ORB: "battle_gimmick",
  TERA_SHARD: "battle_gimmick",
  LOCK_CAPSULE: "lock_capsule",
  MAP: "map",
  DNA_SPLICERS: "fusion",
  IV_SCANNER: "iv_scanner",
  GOLDEN_POKEBALL: "extra_reward",
  SILVER_POKEBALL: "extra_reward",
};

/** Felder generierter Varianten; die meisten sind im Spiel private/protected und werden nur gelesen. */
interface VariantFields {
  stat?: unknown;
  moveType?: unknown;
  berryType?: unknown;
  nature?: unknown;
  moveId?: unknown;
  evolutionItem?: unknown;
  formChangeItem?: unknown;
  pokeballType?: unknown;
  count?: unknown;
}

const VARIANT_KEYS: readonly (readonly [keyof VariantFields, string])[] = [
  ["stat", "stat"],
  ["moveType", "move_type"],
  ["berryType", "berry_type"],
  ["nature", "nature"],
  ["moveId", "move_id"],
  ["evolutionItem", "evolution_item"],
  ["formChangeItem", "form_change_item"],
  ["pokeballType", "pokeball_type"],
  ["count", "count"],
];

/** Felder der Heil-/Beleber-Typen (protected im Spiel). */
interface RestoreFields {
  restorePoints?: unknown;
  restorePercent?: unknown;
}

/** PokemonModifierType bzw. PokemonMoveModifierType; die Klassen sind nur als Typ importierbar. */
interface TargetFilters {
  selectFilter?: (pokemon: PlayerPokemon) => string | null;
  moveSelectFilter?: (pokemonMove: PokemonMove) => string | null;
}

export function itemIdOf(type: ModifierType): string {
  return type.id || type.constructor.name;
}

export function itemFamilyOf(type: ModifierType): ItemFamily {
  const id = itemIdOf(type);
  const family = FAMILY_BY_ID[id];
  if (family) return family;
  if (type.is("PokemonHeldItemModifierType")) return "held_item";
  return "other";
}

export function itemVariantOf(type: ModifierType): ItemVariant {
  const fields = type as unknown as VariantFields;
  const variant: ItemVariant = {};
  for (const [field, key] of VARIANT_KEYS) {
    const value = fields[field];
    if (typeof value === "number" && Number.isInteger(value)) {
      variant[key] = value;
    }
  }
  return variant;
}

function tierOf(type: ModifierType): number {
  return typeof type.tier === "number" ? type.tier : -1;
}

function sameVariant(a: ItemVariant, b: ItemVariant): boolean {
  const keysA = Object.keys(a);
  return keysA.length === Object.keys(b).length && keysA.every(key => a[key] === b[key]);
}

export function describeOwnedModifier(modifier: PersistentModifier): OwnedItem {
  const type = modifier.type;
  const family = itemFamilyOf(type);
  const item: OwnedItem = {
    item_id: itemIdOf(type),
    item_family: family === "other" && modifier.is("PokemonHeldItemModifier") ? "held_item" : family,
    variant: itemVariantOf(type),
    tier: tierOf(type),
    stacks: modifier.getStackCount(),
    max_stacks: modifier.getMaxStackCount(),
  };
  if (modifier.is("LapsingPersistentModifier")) {
    item.max_battles = modifier.getMaxBattles();
    // battleCount zaehlt im Spiel die verbleibenden Kaempfe herunter (lapse: battleCount--).
    item.battles_remaining = Math.max(0, modifier.getBattleCount());
  }
  return item;
}

function findOwned(items: readonly OwnedItem[], itemId: string, variant: ItemVariant): OwnedItem | undefined {
  return items.find(item => item.item_id === itemId && sameVariant(item.variant, variant));
}

// ---------------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------------

function minPpRatio(pokemon: Pokemon): number {
  const moves = pokemon.getMoveset().slice(0, 4);
  if (moves.length === 0) return 0;
  return Math.min(
    ...moves.map(move => {
      const ppMax = move.getMovePp();
      if (ppMax <= 0) return 0;
      return Math.max(0, Math.min(1, (ppMax - move.ppUsed) / ppMax));
    }),
  );
}

function emptyPartySlot(): PartySlot {
  return {
    present: 0,
    fainted: 0,
    hp_ratio: 0,
    level: 0,
    level_ratio_to_cap: 0,
    status: 0,
    types: [],
    base_stat_total: 0,
    move_count: 0,
    min_pp_ratio: 0,
    held_items: [],
  };
}

export function buildPartySlot(pokemon: Pokemon, maxExpLevel: number): PartySlot {
  const fainted = pokemon.isFainted();
  return {
    present: 1,
    fainted: fainted ? 1 : 0,
    hp_ratio: fainted ? 0 : getHpRatio(pokemon.hp, pokemon.getMaxHp()),
    level: pokemon.level,
    level_ratio_to_cap: maxExpLevel > 0 ? pokemon.level / maxExpLevel : 0,
    status: fainted ? 0 : statusOf(pokemon),
    types: typesOf(pokemon),
    base_stat_total: pokemon.getSpeciesForm(true).getBaseStatTotal(),
    move_count: Math.min(4, pokemon.getMoveset().length),
    min_pp_ratio: minPpRatio(pokemon),
    held_items: pokemon.getHeldItems().map(describeOwnedModifier),
  };
}

function wavesUntilNextFixedBattle(scene: BattleScene, waveIndex: number): number {
  const gymOffset = scene.offsetGym ? 0 : 20;
  for (let distance = 1; distance < WAVE_LOOKAHEAD_CAP; distance++) {
    const wave = waveIndex + distance;
    if (wave % 30 === gymOffset || scene.gameMode.isFixedBattle(wave)) {
      return distance;
    }
  }
  return WAVE_LOOKAHEAD_CAP;
}

function partyLuck(party: readonly Pokemon[]): number {
  const luck = party.reduce((total, pokemon) => total + (pokemon.isAllowedInBattle() ? pokemon.getLuck() : 0), 0);
  return Math.max(0, Math.min(MAX_PARTY_LUCK, luck));
}

function pokeballCounts(scene: BattleScene): number[] {
  const counts = scene.pokeballCounts;
  const order = [
    PokeballType.POKEBALL,
    PokeballType.GREAT_BALL,
    PokeballType.ULTRA_BALL,
    PokeballType.ROGUE_BALL,
    PokeballType.MASTER_BALL,
  ] as const;
  return order.map(ballType => counts[ballType] ?? 0);
}

function describeOffer(option: ModifierTypeOption): Omit<OfferItem, "source"> {
  return {
    item_id: itemIdOf(option.type),
    item_family: itemFamilyOf(option.type),
    variant: itemVariantOf(option.type),
    tier: tierOf(option.type),
    upgrade_count: option.upgradeCount,
    cost: Math.max(0, option.cost),
  };
}

function buildOffer(input: ModifierObservationInput): OfferItem[] {
  const rewards = input.rewardOptions.map(
    (option, rewardIndex): OfferItem => ({ source: "reward", reward_index: rewardIndex, ...describeOffer(option), cost: 0 }),
  );
  const shop = input.shopRows.flatMap((row, rowIndex) =>
    row.map(
      (option, columnIndex): OfferItem => ({
        source: "shop",
        shop_row_index: rowIndex,
        shop_column_index: columnIndex,
        ...describeOffer(option),
      }),
    ),
  );
  return [...rewards, ...shop];
}

export function buildModifierState(input: ModifierObservationInput): ModifierState {
  const { scene } = input;
  const party = scene.getPlayerParty();
  const maxExpLevel = scene.getMaxExpLevel();
  const waveIndex = scene.currentBattle.waveIndex;
  const partySlots = Array.from({ length: PARTY_SLOTS }, (_, index) => {
    const pokemon = party[index];
    return pokemon ? buildPartySlot(pokemon, maxExpLevel) : emptyPartySlot();
  });

  return {
    run: {
      wave_index: waveIndex,
      money: scene.money,
      reroll_cost: input.rerollCost,
      reroll_count: input.rerollCount,
      lock_rarities: scene.lockModifierTiers ? 1 : 0,
      shop_available: input.shopRows.some(row => row.length > 0) ? 1 : 0,
      purchases_this_phase: input.purchasesThisPhase,
      waves_until_next_fixed_battle: wavesUntilNextFixedBattle(scene, waveIndex),
      waves_until_next_boss: 10 - (waveIndex % 10),
      party_luck: partyLuck(party),
      goal_profile: input.goalProfile ?? { w_run: 1, w_meta: 0 },
    },
    party_slots: partySlots,
    global_items: scene.modifiers.filter(modifier => !modifier.is("PokemonHeldItemModifier")).map(describeOwnedModifier),
    inventory: { pokeball_counts: pokeballCounts(scene) },
    offer: buildOffer(input),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Kandidaten
// ---------------------------------------------------------------------------------------------------------------------

function candidateEffect(
  type: ModifierType,
  family: ItemFamily,
  target: Pokemon | undefined,
  globalItems: readonly OwnedItem[],
): CandidateEffect | undefined {
  if (family === "level_up" || family === "level_up_all") {
    const candyJar = globalItems.find(item => item.item_id === "CANDY_JAR");
    return { level_gain: 1 + (candyJar?.stacks ?? 0) };
  }
  if (family === "revive_all") {
    return { hp_restore_ratio: 1 };
  }
  if ((family === "heal_hp" || family === "revive") && target) {
    const fields = type as unknown as RestoreFields;
    const restorePoints = typeof fields.restorePoints === "number" ? fields.restorePoints : 0;
    const restorePercent = typeof fields.restorePercent === "number" ? fields.restorePercent : 0;
    const maxHp = target.getMaxHp();
    if (maxHp <= 0) return { hp_restore_ratio: 0 };
    // Wie PokemonHpRestoreModifier.apply, ohne Heil-Charm.
    const healed = Math.max(Math.floor(restorePercent * 0.01 * maxHp), restorePoints, 1);
    const missing = family === "revive" ? maxHp : maxHp - target.hp;
    return { hp_restore_ratio: getHpRatio(Math.min(healed, missing), maxHp) };
  }
  if (family === "attack_type_booster" && target) {
    const moveType = (type as unknown as VariantFields).moveType;
    return { stab_match: typeof moveType === "number" && typesOf(target).includes(moveType) ? 1 : 0 };
  }
  return undefined;
}

interface ItemCandidateContext {
  kind: "take_reward" | "buy_shop_item";
  option: ModifierTypeOption;
  position: Pick<ModifierCandidate, "reward_index" | "shop_row_index" | "shop_column_index">;
  cost: number;
}

function buildItemCandidates(
  context: ItemCandidateContext,
  scene: BattleScene,
  state: ModifierState,
): ModifierCandidate[] {
  const { option } = context;
  const type = option.type;
  const filters = type as unknown as TargetFilters;
  const itemId = itemIdOf(type);
  const family = itemFamilyOf(type);
  const variant = itemVariantOf(type);
  const moneyReason = context.cost > scene.money ? "insufficient_money" : null;
  const base: ModifierCandidate = {
    kind: context.kind,
    mask: 1,
    ...context.position,
    item_id: itemId,
    item_family: family,
    variant,
    tier: tierOf(type),
    upgrade_count: option.upgradeCount,
    cost: context.cost,
  };

  // PokemonModifierType setzt selectFilter immer als eigenes Feld (auch undefined); andere Typen haben keins.
  if (!("selectFilter" in filters)) {
    const owned = findOwned(state.global_items, itemId, variant);
    return [
      withMask(
        {
          ...base,
          owned_stacks: owned?.stacks ?? 0,
          ...(owned ? { owned_max_stacks: owned.max_stacks } : {}),
          ...optionalEffect(candidateEffect(type, family, undefined, state.global_items)),
        },
        moneyReason,
      ),
    ];
  }

  const party = scene.getPlayerParty();
  const candidates: ModifierCandidate[] = [];
  party.slice(0, PARTY_SLOTS).forEach((pokemon, partyIndex) => {
    const owned = findOwned(state.party_slots[partyIndex]?.held_items ?? [], itemId, variant);
    const targetBase: ModifierCandidate = {
      ...base,
      target_party_index: partyIndex,
      owned_stacks: owned?.stacks ?? 0,
      ...(owned ? { owned_max_stacks: owned.max_stacks } : {}),
      ...optionalEffect(candidateEffect(type, family, pokemon, state.global_items)),
    };
    const targetReason = moneyReason ?? filterReason("select_filter", filters.selectFilter?.(pokemon));

    if (!("moveSelectFilter" in filters)) {
      candidates.push(withMask(targetBase, targetReason));
      return;
    }
    const moves = pokemon.getMoveset().slice(0, 4);
    if (moves.length === 0) {
      candidates.push(withMask(targetBase, targetReason ?? "no_valid_move"));
      return;
    }
    moves.forEach((pokemonMove, moveIndex) => {
      const moveReason = targetReason ?? filterReason("move_select_filter", filters.moveSelectFilter?.(pokemonMove));
      candidates.push(withMask({ ...targetBase, target_move_index: moveIndex }, moveReason));
    });
  });
  if (candidates.length === 0) {
    candidates.push(withMask(base, "missing_party_target"));
  }
  return candidates;
}

/** Filter liefern uebersetzte Anzeigetexte; stabiles Praefix fuer Auswertungen, Text nur zur Diagnose. */
function filterReason(prefix: string, text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  return `${prefix}:${text.replace(/\s+/g, " ").trim()}`;
}

function optionalEffect(effect: CandidateEffect | undefined): { effect?: CandidateEffect } {
  return effect ? { effect } : {};
}

function withMask(candidate: ModifierCandidate, reason: string | null): ModifierCandidate {
  if (reason) {
    return { ...candidate, mask: 0, mask_reason: reason };
  }
  return { ...candidate, mask: 1 };
}

function applyBlocker(
  candidates: { candidate: ModifierCandidate; option: ModifierTypeOption | null }[],
  blockCandidate: CandidateBlocker | undefined,
): ModifierCandidate[] {
  return candidates.map(({ candidate, option }) => {
    if (!blockCandidate || candidate.mask === 0 || candidate.kind === "skip" || candidate.kind === "finish_shop") {
      return candidate;
    }
    const reason = blockCandidate(candidate, option);
    return reason ? withMask(candidate, reason) : candidate;
  });
}

export function buildModifierCandidates(input: ModifierObservationInput, state: ModifierState): ModifierCandidate[] {
  const { scene } = input;
  const entries: { candidate: ModifierCandidate; option: ModifierTypeOption | null }[] = [];

  if (input.decisionStage === "shop") {
    input.shopRows.forEach((row, rowIndex) => {
      row.forEach((option, columnIndex) => {
        const context: ItemCandidateContext = {
          kind: "buy_shop_item",
          option,
          position: { shop_row_index: rowIndex, shop_column_index: columnIndex },
          cost: Math.max(0, option.cost),
        };
        for (const candidate of buildItemCandidates(context, scene, state)) {
          entries.push({ candidate, option });
        }
      });
    });
    entries.push({ candidate: { kind: "finish_shop", mask: 1, tier: -1, cost: 0 }, option: null });
    return applyBlocker(entries, input.blockCandidate);
  }

  input.rewardOptions.forEach((option, rewardIndex) => {
    const context: ItemCandidateContext = {
      kind: "take_reward",
      option,
      position: { reward_index: rewardIndex },
      cost: 0,
    };
    for (const candidate of buildItemCandidates(context, scene, state)) {
      entries.push({ candidate, option });
    }
  });

  const rerollReason =
    input.rerollCost < 0 ? "reroll_unavailable" : input.rerollCost > scene.money ? "insufficient_money" : null;
  entries.push({
    candidate: withMask({ kind: "reroll", mask: 1, tier: -1, cost: Math.max(0, input.rerollCost) }, rerollReason),
    option: null,
  });
  const hasLockCapsule = state.global_items.some(item => item.item_id === "LOCK_CAPSULE");
  entries.push({
    candidate: withMask(
      { kind: "toggle_lock_rarities", mask: 1, tier: -1, cost: 0 },
      hasLockCapsule ? null : "requires_lock_capsule",
    ),
    option: null,
  });

  const candidates = applyBlocker(entries, input.blockCandidate);
  const freeRewardAvailable = candidates.some(candidate => candidate.kind === "take_reward" && candidate.mask === 1);
  candidates.push(
    withMask({ kind: "skip", mask: 1, tier: -1, cost: 0 }, freeRewardAvailable ? "skip_while_free_reward" : null),
  );
  return candidates;
}

export function buildModifierObservation(input: ModifierObservationInput): ModifierObservation {
  const state = buildModifierState(input);
  return {
    schema_version: MODIFIER_STATE_SCHEMA_VERSION,
    decision_stage: input.decisionStage,
    state,
    candidates: buildModifierCandidates(input, state),
  };
}
