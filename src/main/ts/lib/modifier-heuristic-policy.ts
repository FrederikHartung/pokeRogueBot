// Feste Modifier-Regel `heuristic_v1` (docs/modifier-benchmark-design.md, Abschnitt 4).
//
// Waehlt aus einer modifier-v1-Observation (State und Kandidaten mit Masken) deterministisch einen Kandidaten. Dient als
// Vergleichsgroesse im Modifier-Benchmark und spaeter als Teil der Explorations-Mischung im Collector. Nur Typ-Importe:
// die Datei laeuft ohne Spiel (Unit-Tests unter Node) und wird wie die Builder neben generierte Collector-Tests kopiert
// (Import "#bot-ts/modifier-heuristic-policy").
import type { ModifierCandidate, ModifierObservation, PartySlot } from "./modifier-observation";

export const MODIFIER_HEURISTIC_POLICY_VERSION = "heuristic_v1";

/** Gratis-Wahl: Gruppen in absteigender Prioritaet; innerhalb einer Gruppe entscheidet die Reihenfolge der IDs. */
export const HEURISTIC_V1_REWARD_PRIORITY: readonly (readonly string[])[] = [
  ["EXP_SHARE", "SUPER_EXP_CHARM", "EXP_CHARM", "CANDY_JAR", "RARER_CANDY", "RARE_CANDY"],
  [
    "LEFTOVERS",
    "SHELL_BELL",
    "FOCUS_BAND",
    "QUICK_CLAW",
    "KINGS_ROCK",
    "SCOPE_LENS",
    "WIDE_LENS",
    "MULTI_LENS",
    "GRIP_CLAW",
    "BASE_STAT_BOOSTER",
    "ATTACK_TYPE_BOOSTER",
    "GOLDEN_PUNCH",
    "MYSTICAL_ROCK",
    "REVIVER_SEED",
    "BERRY",
  ],
  ["TEMP_STAT_STAGE_BOOSTER", "DIRE_HIT"],
  ["ELIXIR", "MAX_ELIXIR", "ETHER", "MAX_ETHER", "PP_UP", "PP_MAX"],
  ["AMULET_COIN", "RELIC_GOLD", "BIG_NUGGET", "NUGGET"],
];

/** Im Collector wirkungslos (es wird nie gefangen; Lockmittel nur bei Doppelkaempfen): zuletzt. */
const LAST_RESORT_FAMILIES = new Set(["lure", "ball"]);
const REVIVE_FAMILIES = new Set(["revive", "revive_all"]);
const REWARD_HEAL_THRESHOLD = 0.5;
const HP_EPSILON = 0.005;

interface Indexed {
  candidate: ModifierCandidate;
  index: number;
}

function usable(observation: ModifierObservation, kind: ModifierCandidate["kind"]): Indexed[] {
  return observation.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(entry => entry.candidate.kind === kind && entry.candidate.mask === 1);
}

function isAlive(slot: PartySlot | undefined): boolean {
  return slot !== undefined && slot.present === 1 && slot.fainted === 0;
}

function slotOf(observation: ModifierObservation, candidate: ModifierCandidate): PartySlot | undefined {
  return candidate.target_party_index === undefined ? undefined : observation.state.party_slots[candidate.target_party_index];
}

/** Kleinster Wert nach `key`, bei Gleichstand der kleinere Kandidaten-Index. */
function minBy(entries: Indexed[], key: (entry: Indexed) => number): Indexed | undefined {
  let best: Indexed | undefined;
  let bestKey = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const value = key(entry);
    if (value < bestKey || (value === bestKey && best !== undefined && entry.index < best.index)) {
      best = entry;
      bestKey = value;
    }
  }
  return best;
}

function pickRevive(observation: ModifierObservation, entries: Indexed[]): Indexed | undefined {
  const anyFainted = observation.state.party_slots.some(slot => slot.present === 1 && slot.fainted === 1);
  if (!anyFainted) return undefined;
  const revives = entries.filter(entry => REVIVE_FAMILIES.has(entry.candidate.item_family ?? ""));
  // Erst der guenstigste, dann der Slot mit kleinstem Index (Kosten sind bei Gratis-Belohnungen 0).
  return minBy(revives, entry => entry.candidate.cost * 10 + (entry.candidate.target_party_index ?? 0));
}

/** Heilung fuer den Slot mit dem niedrigsten HP-Anteil unter `threshold`: guenstigste volle Heilung, sonst die groesste. */
function pickHeal(observation: ModifierObservation, entries: Indexed[], threshold: number): Indexed | undefined {
  const heals = entries.filter(entry => entry.candidate.item_family === "heal_hp" && isAlive(slotOf(observation, entry.candidate)));
  const targets = heals
    .map(entry => entry.candidate.target_party_index!)
    .filter(partyIndex => observation.state.party_slots[partyIndex]!.hp_ratio < threshold);
  if (targets.length === 0) return undefined;
  const target = targets.reduce((best, partyIndex) => {
    const slots = observation.state.party_slots;
    const ratio = slots[partyIndex]!.hp_ratio;
    const bestRatio = slots[best]!.hp_ratio;
    return ratio < bestRatio || (ratio === bestRatio && partyIndex < best) ? partyIndex : best;
  });
  const forTarget = heals.filter(entry => entry.candidate.target_party_index === target);
  const missing = 1 - observation.state.party_slots[target]!.hp_ratio;
  const covering = forTarget.filter(entry => (entry.candidate.effect?.hp_restore_ratio ?? 0) >= missing - HP_EPSILON);
  if (covering.length > 0) {
    return minBy(covering, entry => entry.candidate.cost);
  }
  return minBy(forTarget, entry => -(entry.candidate.effect?.hp_restore_ratio ?? 0) * 1e6 + entry.candidate.cost);
}

/**
 * Ziel innerhalb eines Items: Party-Items auf das lebende Pokemon mit dem hoechsten Level (wie FreeModifierFallback im
 * Live-Bot), Attacken-Items auf den Slot mit dem niedrigsten PP-Anteil. Items ohne Ziel haben genau einen Kandidaten.
 */
function pickTarget(observation: ModifierObservation, entries: Indexed[]): Indexed | undefined {
  const hasMoveTarget = entries.some(entry => entry.candidate.target_move_index !== undefined);
  return minBy(entries, entry => {
    const slot = slotOf(observation, entry.candidate);
    if (!slot) return 0;
    const aliveBias = isAlive(slot) ? 0 : 1e6;
    return hasMoveTarget ? aliveBias + slot.min_pp_ratio * 1000 : aliveBias - slot.level;
  });
}

function pickShop(observation: ModifierObservation): number {
  const buys = usable(observation, "buy_shop_item");
  const choice =
    pickRevive(observation, buys)
    ?? pickHeal(observation, buys, 1 - HP_EPSILON)
    ?? minBy(
      buys.filter(entry => entry.candidate.item_family === "heal_status"),
      entry => entry.candidate.cost * 10 + (entry.candidate.target_party_index ?? 0),
    );
  if (choice) return choice.index;
  const finish = observation.candidates.findIndex(candidate => candidate.kind === "finish_shop" && candidate.mask === 1);
  if (finish >= 0) return finish;
  throw new Error("heuristic_v1: no executable shop candidate");
}

function pickReward(observation: ModifierObservation): number {
  const takes = usable(observation, "take_reward");
  const urgent = pickRevive(observation, takes) ?? pickHeal(observation, takes, REWARD_HEAL_THRESHOLD);
  if (urgent) return urgent.index;

  for (const group of HEURISTIC_V1_REWARD_PRIORITY) {
    for (const itemId of group) {
      const choice = pickTarget(observation, takes.filter(entry => entry.candidate.item_id === itemId));
      if (choice) return choice.index;
    }
  }

  const rest = takes.filter(entry => !LAST_RESORT_FAMILIES.has(entry.candidate.item_family ?? ""));
  const lastResort = takes.filter(entry => entry.candidate.item_family === "lure");
  const balls = takes.filter(entry => entry.candidate.item_family === "ball");
  for (const pool of [rest, lastResort, balls]) {
    if (pool.length === 0) continue;
    const bestTier = Math.max(...pool.map(entry => entry.candidate.tier));
    const firstItem = pool.find(entry => entry.candidate.tier === bestTier)!.candidate;
    const sameItem = pool.filter(
      entry =>
        entry.candidate.reward_index === firstItem.reward_index && entry.candidate.item_id === firstItem.item_id,
    );
    return pickTarget(observation, sameItem)!.index;
  }

  // Kein Reroll in v1: ohne gueltige Belohnung ist skip freigegeben.
  const skip = observation.candidates.findIndex(candidate => candidate.kind === "skip" && candidate.mask === 1);
  if (skip >= 0) return skip;
  throw new Error("heuristic_v1: no executable reward candidate");
}

/** Index des gewaehlten Kandidaten; wirft nur, wenn die Observation keinen ausfuehrbaren Kandidaten hat. */
export function pickHeuristicV1CandidateIndex(observation: ModifierObservation): number {
  return observation.decision_stage === "shop" ? pickShop(observation) : pickReward(observation);
}
