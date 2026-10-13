// Combat-Observation fuer den combat-v4-Contract (docs/rl-schema/combat-transition.schema.json).
//
// Einzige Implementierung des Combat-States: der Szenario-Collector, der strategische Modifier-Collector und die
// JS-Bridge des Live-Bots (window.poru.combat) rufen dieselbe Funktion auf. Die Collector-Runner kopieren diese Datei
// beim Materialisieren ihrer Templates neben den generierten Test und ersetzen den Import "#bot-ts/combat-observation".
// Deshalb hier nur Typ-Importe aus dem Submodul plus reine Enum-Dateien aus "#enums/*" (ohne Laufzeit-Abhaengigkeiten).
import type { BattleScene } from "#app/battle-scene";
import type { Arena } from "#field/arena";
import type { Pokemon } from "#field/pokemon";
import type { Move } from "#moves/move";
import type { PokemonMove } from "#moves/pokemon-move";
import { ArenaTagSide } from "#enums/arena-tag-side";
import { ArenaTagType } from "#enums/arena-tag-type";
import { BattlerTagType } from "#enums/battler-tag-type";
import { MoveCategory } from "#enums/move-category";
import { PokemonType } from "#enums/pokemon-type";
import { BATTLE_STATS, type BattleStat, type EffectiveStat, Stat } from "#enums/stat";
import { StatusEffect } from "#enums/status-effect";

export const COMBAT_STATE_SCHEMA_VERSION = "combat-v4";
export const MOVE_ACTIONS = 4;
export const SWITCH_ACTIONS = 6;
export const COMBAT_ACTION_DIM = MOVE_ACTIONS + SWITCH_ACTIONS;

/** 0 command (CommandPhase), 1 forced_switch (SwitchPhase nach eigenem K.O.), 2 check_switch (Wechselangebot zu Kampfbeginn). */
export type DecisionKind = 0 | 1 | 2;
export const DECISION_KIND_COMMAND: DecisionKind = 0;
export const DECISION_KIND_FORCED_SWITCH: DecisionKind = 1;
export const DECISION_KIND_CHECK_SWITCH: DecisionKind = 2;

/**
 * Verlauf und Entscheidungsart, die der State nicht aus dem Spiel lesen kann. Collector und Live-Bot fuehren ihn mit
 * denselben Regeln (siehe updateCombatDecisionHistory).
 */
export interface CombatDecisionContext {
  decisionKind: DecisionKind;
  lastActionWasSwitch: boolean;
  consecutiveSwitchCount: number;
  /** Party-Index (nach dem Positionstausch des Spiels), auf dem das zuletzt freiwillig herausgenommene Pokemon liegt. */
  lastSwitchOriginPartyIndex: number | null;
  /** Szenario-Collector: Trainerkampf laut Szenario, auch wenn das Spiel keinen Trainer erzeugt hat. */
  isTrainerBattle?: boolean;
}

export interface CombatDecisionHistory {
  lastActionWasSwitch: boolean;
  consecutiveSwitchCount: number;
  lastSwitchOriginPartyIndex: number | null;
}

export interface VolatileState {
  confused: number;
  seeded: number;
  substitute: number;
  trapped: number;
  locked_into_move: number;
  taunted: number;
  infatuated: number;
  drowsy: number;
  perish_song: number;
}

export interface BattlerState {
  status: number;
  stat_stages: number[];
  volatile: VolatileState;
}

export interface EnemyState extends BattlerState {
  types: number[];
  remaining_team_count: number;
  team_hp_ratio: number;
}

export interface SideConditions {
  spikes_layers: number;
  toxic_spikes_layers: number;
  stealth_rock: number;
  sticky_web: number;
  reflect: number;
  light_screen: number;
  aurora_veil: number;
  tailwind: number;
}

export interface FieldState {
  weather: number;
  terrain: number;
  trick_room: number;
  player_side: SideConditions;
  enemy_side: SideConditions;
}

export interface MoveState {
  available: number;
  power_bucket: number;
  effectiveness_bucket: number;
  stab: number;
  pp_low: number;
  priority_bucket: number;
  acts_first_if_used: number;
  can_ko_before_enemy_moves: number;
  move_kind_bucket: number;
  damage_class_bucket: number;
  estimated_damage_ratio_bucket: number;
  estimated_ko_turns_bucket: number;
  accuracy_bucket: number;
  uses_best_offense_stat: number;
  target_immunity_risk: number;
  estimated_damage_ratio: number;
  pp_ratio: number;
  effect_category: number;
  effect_still_useful: number;
}

export interface PartySlotState {
  present: number;
  active: number;
  fainted: number;
  hp_ratio: number;
  level: number;
  types: number[];
  best_damage_into_enemy_bucket: number;
  expected_incoming_damage_bucket: number;
  speed_advantage_bucket: number;
  survives_one_hit: number;
  can_threaten_ko_bucket: number;
  status: number;
  is_last_switch_origin: number;
}

export interface CombatObservation {
  wave_index: number;
  player_hp_ratio: number;
  enemy_hp_ratio: number;
  player_hp_bucket: number;
  enemy_hp_bucket: number;
  hp_diff_bucket: number;
  level_gap_bucket: number;
  is_trainer_battle: number;
  has_legal_switch: number;
  active_hp_critical: number;
  bench_has_healthier_switch: number;
  bench_has_better_matchup_than_active: number;
  active_can_finish_enemy: number;
  alive_bench_count_bucket: number;
  healthy_bench_count_bucket: number;
  best_switch_matchup_bucket: number;
  worst_switch_risk_bucket: number;
  speed_order_advantage: number;
  enemy_has_known_priority_threat: number;
  active_has_any_first_strike_move: number;
  active_best_damage_bucket: number;
  enemy_best_damage_into_active_bucket: number;
  active_survives_next_hit: number;
  enemy_survives_best_hit: number;
  decision_kind: DecisionKind;
  last_action_was_switch: number;
  consecutive_switch_bucket: number;
  battle_turn_bucket: number;
  active: BattlerState;
  enemy: EnemyState;
  field: FieldState;
  moves: MoveState[];
  party_slots: PartySlotState[];
  action_mask: number[];
}

/**
 * TerrainType liegt im Spiel in src/data/terrain.ts, das Laufzeitcode importiert und daher nicht in die Bridge gebuendelt
 * werden soll. Werte: NONE 0, MISTY 1, ELECTRIC 2, GRASSY 3, PSYCHIC 4. Der Szenario-Collector prueft die Werte beim Start
 * gegen das echte Enum (assertCombatObservationEnumParity).
 */
export const TERRAIN_TYPE_VALUES = { NONE: 0, MISTY: 1, ELECTRIC: 2, GRASSY: 3, PSYCHIC: 4 } as const;

export const EFFECT_CATEGORY = {
  NONE: 0,
  SELF_BOOST: 1,
  ENEMY_DEBUFF: 2,
  INFLICT_STATUS: 3,
  HEAL: 4,
  PROTECT: 5,
  HAZARD: 6,
  FIELD: 7,
  OTHER: 8,
} as const;

const LOCKED_INTO_MOVE_TAGS: BattlerTagType[] = [
  BattlerTagType.RECHARGING,
  BattlerTagType.CHARGING,
  BattlerTagType.FRENZY,
  BattlerTagType.ENCORE,
];
const HAZARD_TAGS: ArenaTagType[] = [
  ArenaTagType.SPIKES,
  ArenaTagType.TOXIC_SPIKES,
  ArenaTagType.STEALTH_ROCK,
  ArenaTagType.STICKY_WEB,
];
const HAZARD_MAX_LAYERS: Partial<Record<ArenaTagType, number>> = {
  [ArenaTagType.SPIKES]: 3,
  [ArenaTagType.TOXIC_SPIKES]: 2,
};

// Private Felder einzelner Spielklassen, die keine oeffentliche Getter-API haben. Bewusst als schmale Sichten statt `any`.
type WeatherChangeAttrView = { weatherType: number };
type TerrainChangeAttrView = { terrainType: number };
type LayeredArenaTagView = { layers?: number };

// ---------------------------------------------------------------------------------------------------------------------
// Buckets (Semantik unveraendert seit combat-v3)
// ---------------------------------------------------------------------------------------------------------------------

export function getHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

export function bucketByThresholds(value: number, thresholds: number[]): number {
  for (let idx = 0; idx < thresholds.length; idx += 1) {
    if (value <= thresholds[idx]) {
      return idx;
    }
  }
  return thresholds.length;
}

export function hpBucket(hpRatio: number): number {
  return bucketByThresholds(hpRatio, [0.05, 0.2, 0.4, 0.6, 0.8]);
}

export function hpDiffBucket(diff: number): number {
  return bucketByThresholds(diff, [-0.6, -0.25, -0.1, 0.1, 0.25, 0.6]);
}

export function levelGapBucket(levelGap: number): number {
  return bucketByThresholds(levelGap, [-15, -7, -2, 2, 7, 15]);
}

export function powerBucket(power: number): number {
  if (power <= 0) return 0;
  if (power <= 40) return 1;
  if (power <= 70) return 2;
  if (power <= 100) return 3;
  return 4;
}

export function effectivenessBucket(effectiveness: number): number {
  if (effectiveness <= 0) return 0;
  if (effectiveness <= 0.5) return 1;
  if (effectiveness <= 1.0) return 2;
  if (effectiveness <= 2.0) return 3;
  return 4;
}

export function countBucket(value: number): number {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value <= 3) return 2;
  return 3;
}

export function damageClassBucket(category: number): number {
  if (category === MoveCategory.PHYSICAL) return 0;
  if (category === MoveCategory.SPECIAL) return 1;
  return 2;
}

export function moveKindBucket(move: Move): number {
  const power = Number.isFinite(move.power) ? move.power : 0;
  const priority = Number.isFinite(move.priority) ? move.priority : 0;
  if (move.category === MoveCategory.STATUS || power <= 0) return 0;
  if (priority > 0) return 2;
  return 1;
}

export function priorityBucket(priority: number): number {
  if (priority < 0) return 0;
  if (priority === 0) return 1;
  return 2;
}

export function damageRatioBucket(damageRatio: number): number {
  if (damageRatio <= 0) return 0;
  if (damageRatio < 0.25) return 1;
  if (damageRatio < 0.5) return 2;
  if (damageRatio < 1.0) return 3;
  return 4;
}

export function koTurnsBucket(damageRatio: number, targetHpRatio: number): number {
  if (damageRatio <= 0 || targetHpRatio <= 0) return 0;
  if (damageRatio >= targetHpRatio) return 1;
  if (damageRatio * 2 >= targetHpRatio) return 2;
  return 3;
}

export function accuracyBucket(accuracy: number): number {
  if (accuracy <= 0) return 0;
  if (accuracy < 75) return 1;
  if (accuracy < 90) return 2;
  return 3;
}

export function battleTurnBucket(turn: number): number {
  if (turn <= 1) return 0;
  if (turn === 2) return 1;
  if (turn <= 4) return 2;
  if (turn <= 8) return 3;
  return 4;
}

export function consecutiveSwitchBucket(count: number): number {
  return Math.max(0, Math.min(3, Math.floor(count)));
}

// ---------------------------------------------------------------------------------------------------------------------
// Kampfwerte
// ---------------------------------------------------------------------------------------------------------------------

function safeEffectiveStat(pokemon: Pokemon, stat: EffectiveStat, opponent: Pokemon): number {
  const value = pokemon.getEffectiveStat(stat, { opponent });
  if (Number.isFinite(value)) {
    return value;
  }
  const raw = pokemon.getStat(stat, false);
  return Number.isFinite(raw) ? raw : 0;
}

export function getEffectiveSpeed(pokemon: Pokemon, opponent: Pokemon): number {
  return safeEffectiveStat(pokemon, Stat.SPD, opponent);
}

export function speedOrderAdvantage(player: Pokemon, enemy: Pokemon): number {
  const playerSpeed = getEffectiveSpeed(player, enemy);
  const enemySpeed = getEffectiveSpeed(enemy, player);
  if (playerSpeed > enemySpeed) return 2;
  if (playerSpeed < enemySpeed) return 0;
  return 1;
}

function ppLeftOf(move: PokemonMove): number {
  const ppMax = move.getMovePp();
  const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
  return Math.max(0, ppMax - ppUsed);
}

function isMoveUsable(move: PokemonMove, user: Pokemon): boolean {
  return move.isUsable(user, false, true)[0];
}

export function getBestKnownEnemyPriority(enemy: Pokemon): number {
  return enemy
    .getMoveset()
    .slice(0, 4)
    .reduce((best, move) => {
      const priority = Number.isFinite(move.getMove().priority) ? move.getMove().priority : 0;
      return ppLeftOf(move) > 0 ? Math.max(best, priority) : best;
    }, 0);
}

export function actsFirstIfUsed(player: Pokemon, enemy: Pokemon, move: Move, bestEnemyPriority: number): boolean {
  const priority = Number.isFinite(move.priority) ? move.priority : 0;
  if (priority > bestEnemyPriority) return true;
  if (priority < bestEnemyPriority) return false;
  return getEffectiveSpeed(player, enemy) > getEffectiveSpeed(enemy, player);
}

function typesOf(pokemon: Pokemon): number[] {
  return pokemon
    .getTypes()
    .filter(type => Number.isInteger(type) && type >= 0)
    .slice(0, 2);
}

function moveEffectiveness(target: Pokemon, user: Pokemon, move: Move): number {
  const effectiveness = target.getMoveEffectiveness(user, move, false, true);
  return Number.isFinite(effectiveness) ? effectiveness : 1;
}

/** combat-v3-Schaetzer: vereinfachte Schadensformel mal Effektivitaet, STAB und Trefferquote, relativ zu Max-HP des Ziels. */
export function estimateDamageRatio(user: Pokemon, target: Pokemon, move: Move, effectiveness: number, stab: number): number {
  const power = Number.isFinite(move.power) ? move.power : 0;
  if (power <= 0 || move.category === MoveCategory.STATUS || !Number.isFinite(effectiveness) || effectiveness <= 0) {
    return 0;
  }
  const special = move.category === MoveCategory.SPECIAL;
  const attackStat = safeEffectiveStat(user, special ? Stat.SPATK : Stat.ATK, target);
  const defenseStat = Math.max(1, safeEffectiveStat(target, special ? Stat.SPDEF : Stat.DEF, user));
  const level = Math.max(1, Number.isFinite(user.level) ? user.level : 1);
  const estimated = (((2 * level) / 5 + 2) * power * (attackStat / defenseStat)) / 50;
  const accuracy = Number.isFinite(move.accuracy) ? Math.max(1, Math.min(100, move.accuracy)) / 100 : 1;
  const modifier = effectiveness * (stab ? 1.5 : 1.0) * accuracy;
  return Math.max(0, (estimated * modifier) / Math.max(1, target.getMaxHp()));
}

/**
 * combat-v4: Schaden aus der Spiel-Schadensberechnung (simulated: kein Zufallsfaktor, kein Krit-Wurf), mal Trefferquote,
 * relativ zu Max-HP des Ziels, bei 2 gekappt. Faellt auf den v3-Schaetzer zurueck, falls die Berechnung wirft.
 */
export function gameDamageRatio(user: Pokemon, target: Pokemon, move: Move, fallback: number): number {
  if (move.category === MoveCategory.STATUS || !(move.power > 0)) {
    return 0;
  }
  try {
    const result = target.getAttackDamage({ source: user, move, simulated: true });
    const accuracy = Number.isFinite(move.accuracy) && move.accuracy > 0 ? Math.min(100, move.accuracy) / 100 : 1;
    const ratio = (result.damage * accuracy) / Math.max(1, target.getMaxHp());
    return Math.max(0, Math.min(2, Number.isFinite(ratio) ? ratio : 0));
  } catch {
    return Math.max(0, Math.min(2, fallback));
  }
}

export function usesBestOffenseStat(user: Pokemon, target: Pokemon, move: Move): boolean {
  if (move.category === MoveCategory.STATUS) {
    return false;
  }
  const attack = safeEffectiveStat(user, Stat.ATK, target);
  const specialAttack = safeEffectiveStat(user, Stat.SPATK, target);
  if (move.category === MoveCategory.PHYSICAL) {
    return attack >= specialAttack;
  }
  return specialAttack >= attack;
}

function bestDamageInto(user: Pokemon, target: Pokemon, userTypes: number[]): number {
  return user
    .getMoveset()
    .slice(0, 4)
    .reduce((best, pokemonMove) => {
      if (!isMoveUsable(pokemonMove, user)) return best;
      const move = pokemonMove.getMove();
      const stab = userTypes.includes(move.type) ? 1 : 0;
      return Math.max(best, estimateDamageRatio(user, target, move, moveEffectiveness(target, user, move), stab));
    }, 0);
}

function bestEffectivenessInto(user: Pokemon, target: Pokemon): number {
  return user
    .getMoveset()
    .slice(0, 4)
    .reduce((best, pokemonMove) => {
      if (!isMoveUsable(pokemonMove, user)) return best;
      return Math.max(best, moveEffectiveness(target, user, pokemonMove.getMove()));
    }, 0);
}

function isTrappedSafe(pokemon: Pokemon): boolean {
  try {
    return pokemon.isTrapped() === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// combat-v4: Status, Stufen, Volatiles, Feld
// ---------------------------------------------------------------------------------------------------------------------

export function statusOf(pokemon: Pokemon): number {
  const effect = pokemon.status?.effect ?? StatusEffect.NONE;
  return effect === StatusEffect.FAINT ? StatusEffect.NONE : effect;
}

function hasTag(pokemon: Pokemon, tag: BattlerTagType): number {
  return pokemon.getTag(tag) ? 1 : 0;
}

export function buildVolatileState(pokemon: Pokemon): VolatileState {
  return {
    confused: hasTag(pokemon, BattlerTagType.CONFUSED),
    seeded: hasTag(pokemon, BattlerTagType.SEEDED),
    substitute: hasTag(pokemon, BattlerTagType.SUBSTITUTE),
    trapped: isTrappedSafe(pokemon) ? 1 : 0,
    locked_into_move: LOCKED_INTO_MOVE_TAGS.some(tag => pokemon.getTag(tag)) ? 1 : 0,
    taunted: hasTag(pokemon, BattlerTagType.TAUNT),
    infatuated: hasTag(pokemon, BattlerTagType.INFATUATED),
    drowsy: hasTag(pokemon, BattlerTagType.DROWSY),
    perish_song: hasTag(pokemon, BattlerTagType.PERISH_SONG),
  };
}

export function buildBattlerState(pokemon: Pokemon): BattlerState {
  return {
    status: statusOf(pokemon),
    stat_stages: BATTLE_STATS.map(stat => clampStage(pokemon.getStatStage(stat))),
    volatile: buildVolatileState(pokemon),
  };
}

function clampStage(value: number): number {
  return Number.isFinite(value) ? Math.max(-6, Math.min(6, Math.trunc(value))) : 0;
}

function arenaTagLayers(arena: Arena, tag: ArenaTagType, side: ArenaTagSide): number {
  const found = arena.getTagOnSide(tag, side);
  if (!found) return 0;
  const layers = (found as unknown as LayeredArenaTagView).layers;
  return Number.isFinite(layers) ? Number(layers) : 1;
}

function hasArenaTag(arena: Arena, tag: ArenaTagType, side: ArenaTagSide): number {
  return arena.getTagOnSide(tag, side) ? 1 : 0;
}

export function buildSideConditions(arena: Arena, side: ArenaTagSide): SideConditions {
  return {
    spikes_layers: Math.min(3, arenaTagLayers(arena, ArenaTagType.SPIKES, side)),
    toxic_spikes_layers: Math.min(2, arenaTagLayers(arena, ArenaTagType.TOXIC_SPIKES, side)),
    stealth_rock: hasArenaTag(arena, ArenaTagType.STEALTH_ROCK, side),
    sticky_web: hasArenaTag(arena, ArenaTagType.STICKY_WEB, side),
    reflect: hasArenaTag(arena, ArenaTagType.REFLECT, side),
    light_screen: hasArenaTag(arena, ArenaTagType.LIGHT_SCREEN, side),
    aurora_veil: hasArenaTag(arena, ArenaTagType.AURORA_VEIL, side),
    tailwind: hasArenaTag(arena, ArenaTagType.TAILWIND, side),
  };
}

export function buildFieldState(arena: Arena): FieldState {
  return {
    weather: arena.weather?.weatherType ?? 0,
    terrain: arena.terrain?.terrainType ?? TERRAIN_TYPE_VALUES.NONE,
    trick_room: arena.getTag(ArenaTagType.TRICK_ROOM) ? 1 : 0,
    player_side: buildSideConditions(arena, ArenaTagSide.PLAYER),
    enemy_side: buildSideConditions(arena, ArenaTagSide.ENEMY),
  };
}

/**
 * Hauptwirkung einer Attacke neben Schaden (Kategorien siehe EFFECT_CATEGORY) und ob sie gerade noch etwas bewirkt.
 * Schadensattacken zaehlen nur mit sicherer Wirkung (move.chance >= 100), sonst Kategorie 0.
 */
export function classifyMoveEffect(
  move: Move,
  user: Pokemon,
  target: Pokemon,
  arena: Arena,
): { category: number; stillUseful: number } {
  const isStatusMove = move.category === MoveCategory.STATUS || !(move.power > 0);
  if (!isStatusMove && !(move.chance >= 100)) {
    return { category: EFFECT_CATEGORY.NONE, stillUseful: 1 };
  }
  const useful = (value: boolean) => (value ? 1 : 0);

  if (move.hasAttr("ProtectAttr")) {
    return { category: EFFECT_CATEGORY.PROTECT, stillUseful: 1 };
  }
  if (move.hasAttr("AddSubstituteAttr")) {
    return {
      category: EFFECT_CATEGORY.PROTECT,
      stillUseful: useful(!user.getTag(BattlerTagType.SUBSTITUTE) && user.hp > user.getMaxHp() / 4),
    };
  }
  if (move.hasAttr("HealAttr")) {
    return { category: EFFECT_CATEGORY.HEAL, stillUseful: useful(user.hp < user.getMaxHp()) };
  }
  const trapAttrs = move.getAttrs("AddArenaTrapTagAttr");
  if (trapAttrs.length > 0) {
    const attr = trapAttrs[0];
    const side = attr.selfSideTarget ? ArenaTagSide.PLAYER : ArenaTagSide.ENEMY;
    const maxLayers = HAZARD_MAX_LAYERS[attr.tagType] ?? 1;
    return { category: EFFECT_CATEGORY.HAZARD, stillUseful: useful(arenaTagLayers(arena, attr.tagType, side) < maxLayers) };
  }
  if (move.hasAttr("RemoveArenaTrapAttr")) {
    return {
      category: EFFECT_CATEGORY.HAZARD,
      stillUseful: useful(HAZARD_TAGS.some(tag => arena.getTagOnSide(tag, ArenaTagSide.PLAYER))),
    };
  }
  const weatherAttrs = move.getAttrs("WeatherChangeAttr");
  if (weatherAttrs.length > 0) {
    const weatherType = (weatherAttrs[0] as unknown as WeatherChangeAttrView).weatherType;
    return { category: EFFECT_CATEGORY.FIELD, stillUseful: useful((arena.weather?.weatherType ?? 0) !== weatherType) };
  }
  const terrainAttrs = move.getAttrs("TerrainChangeAttr");
  if (terrainAttrs.length > 0) {
    const terrainType = (terrainAttrs[0] as unknown as TerrainChangeAttrView).terrainType;
    return {
      category: EFFECT_CATEGORY.FIELD,
      stillUseful: useful((arena.terrain?.terrainType ?? TERRAIN_TYPE_VALUES.NONE) !== terrainType),
    };
  }
  const arenaTagAttrs = move.getAttrs("AddArenaTagAttr");
  if (arenaTagAttrs.length > 0) {
    // Screens, Tailwind, Trick Room usw. wirken auf die eigene Seite bzw. beide Seiten.
    return {
      category: EFFECT_CATEGORY.FIELD,
      stillUseful: useful(!arena.getTagOnSide(arenaTagAttrs[0].tagType, ArenaTagSide.PLAYER)),
    };
  }
  const statAttrs = move.getAttrs("StatStageChangeAttr");
  const selfBoost = statAttrs.find(attr => attr.selfTarget && attr.stages > 0);
  if (selfBoost) {
    return {
      category: EFFECT_CATEGORY.SELF_BOOST,
      stillUseful: useful(selfBoost.stats.some((stat: BattleStat) => user.getStatStage(stat) < 6)),
    };
  }
  const enemyDebuff = statAttrs.find(attr => !attr.selfTarget && attr.stages < 0);
  if (enemyDebuff) {
    return {
      category: EFFECT_CATEGORY.ENEMY_DEBUFF,
      stillUseful: useful(enemyDebuff.stats.some((stat: BattleStat) => target.getStatStage(stat) > -6)),
    };
  }
  const statusAttr = move.getAttrs("StatusEffectAttr").find(attr => !attr.selfTarget);
  if (statusAttr) {
    const canSet = target.status == null && target.canSetStatus(statusAttr.effect, true, false, user);
    return { category: EFFECT_CATEGORY.INFLICT_STATUS, stillUseful: useful(canSet) };
  }
  if (move.hasAttr("LeechSeedAttr")) {
    return {
      category: EFFECT_CATEGORY.INFLICT_STATUS,
      stillUseful: useful(!target.getTag(BattlerTagType.SEEDED) && !target.isOfType(PokemonType.GRASS)),
    };
  }
  const tagAttrs = move.getAttrs("AddBattlerTagAttr");
  const enemyTag = tagAttrs.find(attr => !attr.selfTarget);
  if (enemyTag) {
    return { category: EFFECT_CATEGORY.INFLICT_STATUS, stillUseful: useful(!target.getTag(enemyTag.tagType)) };
  }
  const selfTag = tagAttrs.find(attr => attr.selfTarget);
  if (selfTag) {
    return { category: EFFECT_CATEGORY.SELF_BOOST, stillUseful: useful(!user.getTag(selfTag.tagType)) };
  }
  return { category: EFFECT_CATEGORY.OTHER, stillUseful: 1 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Verlauf
// ---------------------------------------------------------------------------------------------------------------------

export function emptyCombatDecisionHistory(): CombatDecisionHistory {
  return { lastActionWasSwitch: false, consecutiveSwitchCount: 0, lastSwitchOriginPartyIndex: null };
}

/**
 * Regeln fuer den Verlauf nach einer Entscheidung (docs/combat-state-v4.md, Abschnitt 3):
 * - command: Wechsel zaehlt hoch und merkt den Herkunfts-Slot, Attacke setzt zurueck.
 * - forced_switch: setzt zurueck (erzwungen, keine Wechselkette).
 * - check_switch: Wechsel zaehlt wie ein freiwilliger Wechsel, "bleiben" setzt last_action_was_switch zurueck.
 * `activePartyIndex` ist der Slot des aktiven Pokemon vor dem Wechsel; nach dem Positionstausch des Spiels liegt das
 * herausgenommene Pokemon auf dem Ziel-Slot des Wechsels.
 */
export function updateCombatDecisionHistory(
  history: CombatDecisionHistory,
  decisionKind: DecisionKind,
  action: number,
  activePartyIndex: number,
): CombatDecisionHistory {
  const isSwitch = action >= MOVE_ACTIONS;
  const targetSlot = action - MOVE_ACTIONS;
  if (decisionKind === DECISION_KIND_FORCED_SWITCH) {
    return emptyCombatDecisionHistory();
  }
  if (!isSwitch || (decisionKind === DECISION_KIND_CHECK_SWITCH && targetSlot === activePartyIndex)) {
    return { lastActionWasSwitch: false, consecutiveSwitchCount: 0, lastSwitchOriginPartyIndex: null };
  }
  return {
    lastActionWasSwitch: true,
    consecutiveSwitchCount: history.consecutiveSwitchCount + 1,
    lastSwitchOriginPartyIndex: targetSlot,
  };
}

export function contextFromHistory(
  history: CombatDecisionHistory,
  decisionKind: DecisionKind,
  isTrainerBattle?: boolean,
): CombatDecisionContext {
  return {
    decisionKind,
    lastActionWasSwitch: history.lastActionWasSwitch,
    consecutiveSwitchCount: history.consecutiveSwitchCount,
    lastSwitchOriginPartyIndex: history.lastSwitchOriginPartyIndex,
    isTrainerBattle,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Observation
// ---------------------------------------------------------------------------------------------------------------------

/** Aktives eigenes Pokemon; bei einem Zwangswechsel nach K.O. das besiegte Pokemon auf Slot 0. */
export function resolveActivePlayerPokemon(scene: BattleScene): Pokemon | null {
  const onField = scene.getPlayerPokemon();
  if (onField) return onField;
  const party = scene.getPlayerParty();
  return party.find(member => member.isOnField()) ?? party[0] ?? null;
}

export function canBuildCombatObservation(scene: BattleScene): boolean {
  return resolveActivePlayerPokemon(scene) != null && scene.getEnemyPokemon() != null;
}

/**
 * Baut die combat-v4-Observation fuer einen Einzelkampf. Wirft, wenn kein aktiver Gegner existiert (z. B. waehrend der
 * Gegner nach einem K.O. noch nicht nachgeschickt ist); Aufrufer pruefen vorher canBuildCombatObservation.
 */
export function buildCombatObservation(scene: BattleScene, context: CombatDecisionContext): CombatObservation {
  const player = resolveActivePlayerPokemon(scene);
  const enemy = scene.getEnemyPokemon();
  if (!player || !enemy) {
    throw new Error("Missing active battlers while building combat observation");
  }
  const decisionKind = context.decisionKind;
  const arena = scene.arena;

  const playerTypes = typesOf(player);
  const enemyTypes = typesOf(enemy);
  const moveSet = player.getMoveset().slice(0, 4);
  const playerHpRatio = getHpRatio(player.hp, player.getMaxHp());
  const enemyHpRatio = getHpRatio(enemy.hp, enemy.getMaxHp());
  const speedAdvantage = speedOrderAdvantage(player, enemy);
  const bestKnownEnemyPriority = getBestKnownEnemyPriority(enemy);
  const activeBestMoveEffectiveness = bestEffectivenessInto(player, enemy);
  const activeBestDamageRatio = bestDamageInto(player, enemy, playerTypes);
  const enemyBestDamageIntoActive = bestDamageInto(enemy, player, enemyTypes);

  const moves: MoveState[] = moveSet.map(pokemonMove => {
    const move = pokemonMove.getMove();
    const ppMax = pokemonMove.getMovePp();
    const ppLeft = ppLeftOf(pokemonMove);
    const ppRatio = ppMax > 0 ? ppLeft / ppMax : 0;
    const effectiveness = moveEffectiveness(enemy, player, move);
    const stab = playerTypes.includes(move.type) ? 1 : 0;
    const available = isMoveUsable(pokemonMove, player) ? 1 : 0;
    const actsFirst = available === 1 && actsFirstIfUsed(player, enemy, move, bestKnownEnemyPriority);
    const estimatedDamageRatio = estimateDamageRatio(player, enemy, move, effectiveness, stab);
    const effect = classifyMoveEffect(move, player, enemy, arena);
    return {
      available,
      power_bucket: powerBucket(Number.isFinite(move.power) ? move.power : 0),
      effectiveness_bucket: effectivenessBucket(effectiveness),
      stab,
      pp_low: ppLeft > 0 && ppRatio <= 0.2 ? 1 : 0,
      priority_bucket: priorityBucket(Number.isFinite(move.priority) ? move.priority : 0),
      acts_first_if_used: actsFirst ? 1 : 0,
      can_ko_before_enemy_moves: actsFirst && estimatedDamageRatio >= enemyHpRatio ? 1 : 0,
      move_kind_bucket: moveKindBucket(move),
      damage_class_bucket: damageClassBucket(move.category),
      estimated_damage_ratio_bucket: damageRatioBucket(estimatedDamageRatio),
      estimated_ko_turns_bucket: koTurnsBucket(estimatedDamageRatio, enemyHpRatio),
      accuracy_bucket: accuracyBucket(Number.isFinite(move.accuracy) ? move.accuracy : 100),
      uses_best_offense_stat: usesBestOffenseStat(player, enemy, move) ? 1 : 0,
      target_immunity_risk: effectiveness <= 0 ? 1 : 0,
      estimated_damage_ratio: gameDamageRatio(player, enemy, move, estimatedDamageRatio),
      pp_ratio: Math.max(0, Math.min(1, ppRatio)),
      effect_category: effect.category,
      effect_still_useful: effect.stillUseful,
    };
  });
  const activeHasAnyFirstStrikeMove = moves.some(move => move.acts_first_if_used === 1);

  const actionMask = Array.from({ length: COMBAT_ACTION_DIM }, () => 0);
  if (decisionKind === DECISION_KIND_COMMAND) {
    for (let idx = 0; idx < moves.length; idx += 1) {
      actionMask[idx] = moves[idx].available;
    }
  }

  const party = scene.getPlayerParty();
  const activeTrapped = decisionKind !== DECISION_KIND_FORCED_SWITCH && isTrappedSafe(player);
  const switchableMembers: Array<{ hpRatio: number; bestEffectiveness: number }> = [];
  const partySlots: PartySlotState[] = Array.from({ length: 6 }, (_, slot) => {
    const member = party[slot];
    if (!member) {
      return {
        present: 0,
        active: 0,
        fainted: 0,
        hp_ratio: 0,
        level: 0,
        types: [],
        best_damage_into_enemy_bucket: 0,
        expected_incoming_damage_bucket: 0,
        speed_advantage_bucket: 1,
        survives_one_hit: 0,
        can_threaten_ko_bucket: 0,
        status: 0,
        is_last_switch_origin: 0,
      };
    }

    const hpRatio = getHpRatio(member.hp, member.getMaxHp());
    const memberTypes = typesOf(member);
    const canSwitch = !member.isOnField() && !member.isFainted() && member.isAllowedInBattle();
    const bestDamageIntoEnemy = bestDamageInto(member, enemy, memberTypes);
    const expectedIncomingDamage = bestDamageInto(enemy, member, enemyTypes);
    if (decisionKind === DECISION_KIND_CHECK_SWITCH && member === player) {
      // Wechselangebot: der Slot des aktiven Pokemon bedeutet "nicht wechseln".
      actionMask[MOVE_ACTIONS + slot] = 1;
    } else {
      actionMask[MOVE_ACTIONS + slot] = canSwitch && !activeTrapped ? 1 : 0;
    }
    if (canSwitch) {
      switchableMembers.push({ hpRatio, bestEffectiveness: bestEffectivenessInto(member, enemy) });
    }

    return {
      present: 1,
      active: member.isOnField() ? 1 : 0,
      fainted: member.isFainted() ? 1 : 0,
      hp_ratio: hpRatio,
      level: member.level,
      types: memberTypes,
      best_damage_into_enemy_bucket: damageRatioBucket(bestDamageIntoEnemy),
      expected_incoming_damage_bucket: damageRatioBucket(expectedIncomingDamage),
      speed_advantage_bucket: speedOrderAdvantage(member, enemy),
      survives_one_hit: expectedIncomingDamage < hpRatio ? 1 : 0,
      can_threaten_ko_bucket: koTurnsBucket(bestDamageIntoEnemy, enemyHpRatio),
      status: statusOf(member),
      is_last_switch_origin: context.lastSwitchOriginPartyIndex === slot ? 1 : 0,
    };
  });

  const aliveBenchCount = switchableMembers.length;
  const healthyBenchCount = switchableMembers.filter(member => member.hpRatio > 0.5).length;
  const bestSwitchEffectiveness = switchableMembers.reduce((best, member) => Math.max(best, member.bestEffectiveness), 0);
  const lowestSwitchHp = switchableMembers.reduce((lowest, member) => Math.min(lowest, member.hpRatio), 1);
  const worstSwitchRiskBucket =
    switchableMembers.length === 0
      ? 0
      : lowestSwitchHp <= 0.25
        ? 3
        : lowestSwitchHp <= 0.5
          ? 2
          : lowestSwitchHp <= 0.75
            ? 1
            : 0;
  const battle = scene.currentBattle;
  const isTrainerBattle = battle?.trainer != null || context.isTrainerBattle === true;
  const enemyParty = scene.getEnemyParty();
  const enemyTeamMaxHp = enemyParty.reduce((sum, member) => sum + Math.max(0, member.getMaxHp()), 0);
  const enemyTeamHp = enemyParty.reduce((sum, member) => sum + Math.max(0, member.isFainted() ? 0 : member.hp), 0);

  return {
    wave_index: battle.waveIndex,
    player_hp_ratio: playerHpRatio,
    enemy_hp_ratio: enemyHpRatio,
    player_hp_bucket: hpBucket(playerHpRatio),
    enemy_hp_bucket: hpBucket(enemyHpRatio),
    hp_diff_bucket: hpDiffBucket(playerHpRatio - enemyHpRatio),
    level_gap_bucket: levelGapBucket(player.level - enemy.level),
    is_trainer_battle: isTrainerBattle ? 1 : 0,
    has_legal_switch: aliveBenchCount > 0 ? 1 : 0,
    active_hp_critical: playerHpRatio <= 0.25 ? 1 : 0,
    bench_has_healthier_switch: switchableMembers.some(member => member.hpRatio > playerHpRatio + 0.15) ? 1 : 0,
    bench_has_better_matchup_than_active: bestSwitchEffectiveness > activeBestMoveEffectiveness ? 1 : 0,
    active_can_finish_enemy: enemyHpRatio <= 0.25 && activeBestMoveEffectiveness >= 1.0 ? 1 : 0,
    alive_bench_count_bucket: countBucket(aliveBenchCount),
    healthy_bench_count_bucket: countBucket(healthyBenchCount),
    best_switch_matchup_bucket: effectivenessBucket(bestSwitchEffectiveness),
    worst_switch_risk_bucket: worstSwitchRiskBucket,
    speed_order_advantage: speedAdvantage,
    enemy_has_known_priority_threat: bestKnownEnemyPriority > 0 ? 1 : 0,
    active_has_any_first_strike_move: activeHasAnyFirstStrikeMove ? 1 : 0,
    active_best_damage_bucket: damageRatioBucket(activeBestDamageRatio),
    enemy_best_damage_into_active_bucket: damageRatioBucket(enemyBestDamageIntoActive),
    active_survives_next_hit: enemyBestDamageIntoActive < playerHpRatio ? 1 : 0,
    enemy_survives_best_hit: activeBestDamageRatio < enemyHpRatio ? 1 : 0,
    decision_kind: decisionKind,
    last_action_was_switch: context.lastActionWasSwitch ? 1 : 0,
    consecutive_switch_bucket: consecutiveSwitchBucket(context.consecutiveSwitchCount),
    battle_turn_bucket: battleTurnBucket(Number.isFinite(battle.turn) ? battle.turn : 0),
    active: buildBattlerState(player),
    enemy: {
      ...buildBattlerState(enemy),
      types: enemyTypes,
      remaining_team_count: Math.min(6, enemyParty.filter(member => !member.isFainted()).length),
      team_hp_ratio: enemyTeamMaxHp > 0 ? Math.max(0, Math.min(1, enemyTeamHp / enemyTeamMaxHp)) : 0,
    },
    field: buildFieldState(arena),
    moves,
    party_slots: partySlots,
    action_mask: actionMask,
  };
}

/** Index des aktiven Party-Slots in einer Observation, -1 wenn keiner aktiv ist (z. B. Zwangswechsel nach K.O.). */
export function findActivePartySlotIndex(observation: Pick<CombatObservation, "party_slots">): number {
  return observation.party_slots.findIndex(slot => slot.active === 1);
}

/**
 * Prueft die lokal gespiegelten Enum-Werte gegen die echten Spiel-Enums. Der Szenario-Collector ruft das einmal pro Lauf
 * auf, damit ein Submodul-Update, das Werte verschiebt, laut scheitert statt still falsche Features zu erzeugen.
 */
export function assertCombatObservationEnumParity(terrainTypeEnum: Record<string, string | number>): void {
  for (const [name, value] of Object.entries(TERRAIN_TYPE_VALUES)) {
    if (terrainTypeEnum[name] !== value) {
      throw new Error(`TerrainType.${name} drifted: expected ${value}, got ${String(terrainTypeEnum[name])}`);
    }
  }
}
