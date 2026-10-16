// Rollouts fuer Modifier-Entscheidungen (docs/modifier-rollout-plan.md, Phase 1).
//
// Ein Rollout spielt die Entscheidungen eines Referenzlaufs (heuristic_v1) bis zum Schritt `branch_step` nach, waehlt
// dort eine Alternative und laesst danach heuristic_v1 weiterspielen. Weil die Runs pro Seed deterministisch sind,
// gehoert der Unterschied in der erreichten Welle genau dieser einen Entscheidung.
//
// Nur Typ-Importe: die Datei laeuft ohne Spiel (Unit-Tests und Orchestrierung unter Node) und wird wie die Builder
// neben generierte Collector-Tests kopiert (Import "#bot-ts/modifier-rollout"). Das Ziel einer Alternative waehlt eine
// uebergebene Funktion (im Collector `pickHeuristicV1TargetIndex`), damit hier kein Laufzeit-Import noetig ist.
import type { ModifierCandidate, ModifierObservation } from "./modifier-observation";

export const MODIFIER_ROLLOUT_POLICY = "rollout_replay_v1";
export const MODIFIER_ROLLOUT_SPEC_SCHEMA_VERSION = "modifier_rollout_spec_v1";
export const DEFAULT_MAX_ROLLOUT_ALTERNATIVES = 5;

/** Ein nachzuspielender Schritt des Referenzlaufs. */
export interface RolloutReferenceStep {
  step_index: number;
  candidate_index: number;
  label: string;
  observation_hash: string;
}

export interface RolloutAlternative {
  candidate_index: number;
  label: string;
}

/** Auftrag fuer einen Rollout-Run (eine Datei pro Run, Pfad per Env an den Collector). */
export interface RolloutSpec {
  schema_version: typeof MODIFIER_ROLLOUT_SPEC_SCHEMA_VERSION;
  reference_id: string;
  seed: string;
  branch_step: number;
  alternative: RolloutAlternative;
  /** Schritte 0..branch_step des Referenzlaufs; der letzte dient nur der Hash-Pruefung im Verzweigungs-State. */
  reference_steps: RolloutReferenceStep[];
}

/** Episode-Feld `rollout` im Collector-Output. */
export interface RolloutEpisodeInfo {
  reference_id: string;
  branch_step: number;
  alternative_label: string;
  alternative_candidate_index: number;
  replay_verified_steps: number;
}

export type RolloutChoice =
  | { source: "replay" | "alternative"; candidateIndex: number }
  | { source: "continuation" };

export type TargetPicker = (observation: ModifierObservation, candidateIndices: readonly number[]) => number | undefined;

/** Wahl als vergleichbarer Schluessel: Art, Item, Variante, Position im Angebot und Ziel. */
export function candidateLabel(candidate: ModifierCandidate): string {
  const variant = candidate.variant
    ? Object.keys(candidate.variant).sort().map(key => `${key}=${candidate.variant![key]}`).join(",")
    : "";
  return [
    candidate.kind,
    candidate.item_id ?? "",
    variant,
    candidate.reward_index ?? "",
    candidate.shop_row_index ?? "",
    candidate.shop_column_index ?? "",
    candidate.target_party_index ?? "",
    candidate.target_move_index ?? "",
  ].join("|");
}

/** cyrb53 als zwei 32-Bit-Haelften; reicht, um abweichende States zu erkennen (keine Kryptografie noetig). */
function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash ueber Stufe, State und Kandidaten. Gleich fuer die Live-Observation und ihre JSON-Kopie im Output (JSON.stringify
 * laesst undefined-Felder in beiden Faellen weg), daher lassen sich Referenz-Hashes aus gespeicherten Runs berechnen.
 */
export function observationHash(observation: Pick<ModifierObservation, "decision_stage" | "state" | "candidates">): string {
  return hashText(JSON.stringify([observation.decision_stage, observation.state, observation.candidates]));
}

/**
 * Alternativen zur Referenzwahl in einem State, hoechstens `maxAlternatives`:
 * - Gratis-Belohnung: jedes andere angebotene Item einmal, Ziel nach `pickTarget`.
 * - Shop: nur die erste Shop-Entscheidung einer Welle (`firstShopDecisionInWave`); kauft die Referenz, ist die
 *   Alternative `finish_shop`. Beendet die Referenz den Shop, gibt es keine Alternative.
 * Reihenfolge wie im Angebot, damit Job-Listen reproduzierbar sind.
 */
export function listRolloutAlternatives(
  observation: ModifierObservation,
  referenceIndex: number,
  pickTarget: TargetPicker,
  options: { firstShopDecisionInWave: boolean; maxAlternatives?: number },
): RolloutAlternative[] {
  const maxAlternatives = options.maxAlternatives ?? DEFAULT_MAX_ROLLOUT_ALTERNATIVES;
  const reference = observation.candidates[referenceIndex];
  if (!reference) {
    throw new Error(`Reference candidate ${referenceIndex} missing`);
  }
  const alternatives: RolloutAlternative[] = [];
  if (observation.decision_stage === "shop") {
    if (!options.firstShopDecisionInWave || reference.kind !== "buy_shop_item") {
      return [];
    }
    const finish = observation.candidates.findIndex(candidate => candidate.kind === "finish_shop" && candidate.mask === 1);
    if (finish >= 0) {
      alternatives.push({ candidate_index: finish, label: candidateLabel(observation.candidates[finish]!) });
    }
    return alternatives.slice(0, maxAlternatives);
  }

  const byReward = new Map<number, number[]>();
  observation.candidates.forEach((candidate, index) => {
    if (candidate.kind !== "take_reward" || candidate.mask !== 1 || candidate.reward_index === undefined) {
      return;
    }
    byReward.set(candidate.reward_index, [...(byReward.get(candidate.reward_index) ?? []), index]);
  });
  for (const [rewardIndex, indices] of [...byReward.entries()].sort((a, b) => a[0] - b[0])) {
    if (reference.kind === "take_reward" && reference.reward_index === rewardIndex) {
      continue;
    }
    const chosen = pickTarget(observation, indices);
    if (chosen === undefined) {
      continue;
    }
    alternatives.push({ candidate_index: chosen, label: candidateLabel(observation.candidates[chosen]!) });
  }
  return alternatives.slice(0, maxAlternatives);
}

export class RolloutReplayDivergence extends Error {
  constructor(detail: string) {
    super(`replay_divergence:${detail}`);
    this.name = "RolloutReplayDivergence";
  }
}

export function validateRolloutSpec(value: unknown): RolloutSpec {
  const spec = value as RolloutSpec;
  if (!spec || typeof spec !== "object" || spec.schema_version !== MODIFIER_ROLLOUT_SPEC_SCHEMA_VERSION) {
    throw new Error(`Unsupported rollout spec: ${JSON.stringify((spec as { schema_version?: unknown })?.schema_version)}`);
  }
  if (!Number.isInteger(spec.branch_step) || spec.branch_step < 0) {
    throw new Error(`Invalid rollout branch_step: ${String(spec.branch_step)}`);
  }
  if (!Array.isArray(spec.reference_steps) || spec.reference_steps.length !== spec.branch_step + 1) {
    throw new Error(`Rollout spec needs reference steps 0..branch_step (${spec.branch_step + 1}), got ${spec.reference_steps?.length}`);
  }
  spec.reference_steps.forEach((step, index) => {
    if (step.step_index !== index || typeof step.observation_hash !== "string" || typeof step.label !== "string") {
      throw new Error(`Invalid rollout reference step ${index}`);
    }
  });
  if (!spec.alternative || !Number.isInteger(spec.alternative.candidate_index) || typeof spec.alternative.label !== "string") {
    throw new Error("Invalid rollout alternative");
  }
  return spec;
}

/**
 * Steuert die Wahl eines Rollout-Runs Schritt fuer Schritt. Vor und an der Verzweigung muss der State-Hash zur
 * Referenz passen und der Kandidat am gespeicherten Index dasselbe Label tragen; sonst `RolloutReplayDivergence`
 * (technischer Fehler, keine still falschen Daten). Nach der Verzweigung `continuation`: der Aufrufer nutzt heuristic_v1.
 */
export class RolloutReplayController {
  private readonly spec: RolloutSpec;
  private verifiedSteps = 0;

  constructor(spec: RolloutSpec) {
    this.spec = spec;
  }

  choose(stepIndex: number, observation: ModifierObservation): RolloutChoice {
    if (stepIndex > this.spec.branch_step) {
      return { source: "continuation" };
    }
    const reference = this.spec.reference_steps[stepIndex]!;
    const hash = observationHash(observation);
    if (hash !== reference.observation_hash) {
      throw new RolloutReplayDivergence(`state_hash:step=${stepIndex}:expected=${reference.observation_hash}:got=${hash}`);
    }
    const target = stepIndex === this.spec.branch_step ? this.spec.alternative : reference;
    const candidate = observation.candidates[target.candidate_index];
    if (!candidate || candidate.mask !== 1 || candidateLabel(candidate) !== target.label) {
      throw new RolloutReplayDivergence(
        `label:step=${stepIndex}:expected=${target.label}:got=${candidate ? candidateLabel(candidate) : "missing"}`,
      );
    }
    this.verifiedSteps += 1;
    return { source: stepIndex === this.spec.branch_step ? "alternative" : "replay", candidateIndex: target.candidate_index };
  }

  /** Wirft, wenn der Run endete, bevor die Verzweigung erreicht war (der Referenzlauf kam weiter). */
  assertBranchReached(): void {
    if (this.verifiedSteps < this.spec.branch_step + 1) {
      throw new RolloutReplayDivergence(`ended_before_branch:verified=${this.verifiedSteps}:branch_step=${this.spec.branch_step}`);
    }
  }

  episodeInfo(): RolloutEpisodeInfo {
    return {
      reference_id: this.spec.reference_id,
      branch_step: this.spec.branch_step,
      alternative_label: this.spec.alternative.label,
      alternative_candidate_index: this.spec.alternative.candidate_index,
      replay_verified_steps: this.verifiedSteps,
    };
  }
}

/** Gespeicherter Schritt eines Referenzlaufs (Ausschnitt aus dem Collector-Output). */
export interface ReferenceStepRecord {
  step_index: number;
  wave_index: number;
  modifier_transition: ModifierObservation & { selected_candidate_index: number };
}

export interface RolloutJob {
  job_id: string;
  branch_step: number;
  wave_index: number;
  decision_stage: ModifierObservation["decision_stage"];
  alternative: RolloutAlternative;
}

/** Referenz-Schritte (Label und Hash) eines gespeicherten Laufs. */
export function referenceStepsOf(steps: readonly ReferenceStepRecord[]): RolloutReferenceStep[] {
  return steps.map((step, index) => {
    if (step.step_index !== index) {
      throw new Error(`Reference steps must be contiguous: position ${index} has step_index ${step.step_index}`);
    }
    const transition = step.modifier_transition;
    const candidate = transition.candidates[transition.selected_candidate_index];
    if (!candidate) {
      throw new Error(`Reference step ${index} has no selected candidate`);
    }
    return {
      step_index: index,
      candidate_index: transition.selected_candidate_index,
      label: candidateLabel(candidate),
      observation_hash: observationHash(transition),
    };
  });
}

/** Alle Rollout-Jobs eines Referenzlaufs: je Entscheidung und Alternative einer. */
export function buildRolloutJobs(
  steps: readonly ReferenceStepRecord[],
  pickTarget: TargetPicker,
  maxAlternatives = DEFAULT_MAX_ROLLOUT_ALTERNATIVES,
): RolloutJob[] {
  const jobs: RolloutJob[] = [];
  steps.forEach((step, index) => {
    const transition = step.modifier_transition;
    const previous = steps[index - 1];
    const firstShopDecisionInWave = transition.decision_stage === "shop" && previous?.wave_index !== step.wave_index;
    const alternatives = listRolloutAlternatives(transition, transition.selected_candidate_index, pickTarget, {
      firstShopDecisionInWave,
      maxAlternatives,
    });
    alternatives.forEach((alternative, alternativeIndex) => {
      jobs.push({
        job_id: `k${String(index).padStart(3, "0")}-a${alternativeIndex}`,
        branch_step: index,
        wave_index: step.wave_index,
        decision_stage: transition.decision_stage,
        alternative,
      });
    });
  });
  return jobs;
}

export function buildRolloutSpec(
  referenceId: string,
  seed: string,
  referenceSteps: readonly RolloutReferenceStep[],
  job: Pick<RolloutJob, "branch_step" | "alternative">,
): RolloutSpec {
  return {
    schema_version: MODIFIER_ROLLOUT_SPEC_SCHEMA_VERSION,
    reference_id: referenceId,
    seed,
    branch_step: job.branch_step,
    alternative: job.alternative,
    reference_steps: referenceSteps.slice(0, job.branch_step + 1),
  };
}
