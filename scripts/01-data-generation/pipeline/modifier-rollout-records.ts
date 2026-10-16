// Rollout-Datensatz `modifier_rollout_record_v1` (docs/modifier-rollout-plan.md, Phase 3) und Pilot-Auswertung.
//
// Ein Record pro Entscheidung des Referenzlaufs, fuer die mindestens ein Rollout regulaer endete: State und Kandidaten
// (wie modifier-v1), Referenzwahl mit erreichter Welle, je Alternative die erreichte Welle und der Vorteil in Wellen.
// Gleichstaende in der Welle loest `final_party_level_sum` auf (Summe der Party-Level bei der letzten
// Modifier-Entscheidung des Runs); die Welle bleibt das Hauptkriterium.
import type { ModifierObservation } from "../../../src/main/ts/lib/modifier-observation.ts";
import { candidateLabel, type RolloutJob } from "../../../src/main/ts/lib/modifier-rollout.ts";

export const MODIFIER_ROLLOUT_RECORD_SCHEMA_VERSION = "modifier_rollout_record_v1";

export interface EpisodeOutcome {
  wave_reached: number;
  final_party_level_sum: number;
  termination_reason: string;
}

export interface RolloutRecordAlternative {
  job_id: string;
  candidate_index: number;
  label: string;
  wave_reached: number;
  final_party_level_sum: number;
  /** wave_reached(Alternative) - wave_reached(Referenz). */
  advantage_waves: number;
  termination_reason: string;
}

export interface RolloutRecord {
  schema_version: typeof MODIFIER_ROLLOUT_RECORD_SCHEMA_VERSION;
  seed: string;
  reference_id: string;
  step_index: number;
  wave_index: number;
  decision_stage: ModifierObservation["decision_stage"];
  observation: ModifierObservation;
  reference_candidate_index: number;
  reference_label: string;
  reference_wave_reached: number;
  reference_final_party_level_sum: number;
  alternatives: RolloutRecordAlternative[];
  /** Alternativen ohne regulaeres Ergebnis (technischer Fehler, replay_divergence); nicht fuer das Training. */
  failed_job_ids: string[];
}

interface StoredStep {
  step_index: number;
  wave_index: number;
  modifier_transition: ModifierObservation & { selected_candidate_index: number; immediate_reward?: number };
}

interface StoredEpisode {
  wave_reached: number;
  termination_reason: string;
  steps: StoredStep[];
}

export function episodeOutcome(episode: StoredEpisode): EpisodeOutcome {
  const lastStep = episode.steps[episode.steps.length - 1];
  const levelSum = lastStep
    ? lastStep.modifier_transition.state.party_slots
      .filter(slot => slot.present === 1)
      .reduce((sum, slot) => sum + slot.level, 0)
    : 0;
  return { wave_reached: episode.wave_reached, final_party_level_sum: levelSum, termination_reason: episode.termination_reason };
}

function observationOf(step: StoredStep): ModifierObservation {
  const { schema_version, decision_stage, state, candidates } = step.modifier_transition;
  return { schema_version, decision_stage, state, candidates };
}

export type JobResult =
  | { job: RolloutJob; status: "regular"; outcome: EpisodeOutcome }
  | { job: RolloutJob; status: "failed"; reason: string };

export function buildRolloutRecords(
  seed: string,
  referenceId: string,
  reference: StoredEpisode,
  results: readonly JobResult[],
): RolloutRecord[] {
  const referenceOutcome = episodeOutcome(reference);
  const byStep = new Map<number, JobResult[]>();
  for (const result of results) {
    byStep.set(result.job.branch_step, [...(byStep.get(result.job.branch_step) ?? []), result]);
  }
  const records: RolloutRecord[] = [];
  for (const [stepIndex, stepResults] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
    const step = reference.steps[stepIndex];
    if (!step) {
      throw new Error(`Rollout result for missing reference step ${stepIndex} (${seed})`);
    }
    const alternatives: RolloutRecordAlternative[] = [];
    const failed: string[] = [];
    for (const result of stepResults) {
      if (result.status !== "regular") {
        failed.push(result.job.job_id);
        continue;
      }
      alternatives.push({
        job_id: result.job.job_id,
        candidate_index: result.job.alternative.candidate_index,
        label: result.job.alternative.label,
        wave_reached: result.outcome.wave_reached,
        final_party_level_sum: result.outcome.final_party_level_sum,
        advantage_waves: result.outcome.wave_reached - referenceOutcome.wave_reached,
        termination_reason: result.outcome.termination_reason,
      });
    }
    if (alternatives.length === 0) {
      continue;
    }
    const transition = step.modifier_transition;
    records.push({
      schema_version: MODIFIER_ROLLOUT_RECORD_SCHEMA_VERSION,
      seed,
      reference_id: referenceId,
      step_index: stepIndex,
      wave_index: step.wave_index,
      decision_stage: transition.decision_stage,
      observation: observationOf(step),
      reference_candidate_index: transition.selected_candidate_index,
      reference_label: candidateLabel(transition.candidates[transition.selected_candidate_index]!),
      reference_wave_reached: referenceOutcome.wave_reached,
      reference_final_party_level_sum: referenceOutcome.final_party_level_sum,
      alternatives,
      failed_job_ids: failed.sort(),
    });
  }
  return records;
}

export function validateRolloutRecord(value: unknown, context = "rollout record"): RolloutRecord {
  const record = value as RolloutRecord;
  const fail = (message: string): never => {
    throw new Error(`${context}: ${message}`);
  };
  if (!record || typeof record !== "object") fail("not an object");
  if (record.schema_version !== MODIFIER_ROLLOUT_RECORD_SCHEMA_VERSION) fail(`schema_version ${String(record.schema_version)}`);
  for (const key of ["seed", "reference_id", "reference_label"] as const) {
    if (typeof record[key] !== "string" || record[key].length === 0) fail(`${key} must be a non-empty string`);
  }
  for (const key of ["step_index", "wave_index", "reference_candidate_index", "reference_wave_reached", "reference_final_party_level_sum"] as const) {
    if (!Number.isInteger(record[key]) || record[key] < 0) fail(`${key} must be a non-negative integer`);
  }
  if (record.decision_stage !== "shop" && record.decision_stage !== "reward") fail(`decision_stage ${String(record.decision_stage)}`);
  const candidates = record.observation?.candidates;
  if (!Array.isArray(candidates) || record.observation.decision_stage !== record.decision_stage) fail("observation mismatch");
  const referenceCandidate = candidates[record.reference_candidate_index];
  if (!referenceCandidate || candidateLabel(referenceCandidate) !== record.reference_label) fail("reference label mismatch");
  if (!Array.isArray(record.alternatives) || record.alternatives.length === 0) fail("alternatives must be non-empty");
  const seen = new Set<number>([record.reference_candidate_index]);
  record.alternatives.forEach((alternative, index) => {
    const candidate = candidates[alternative.candidate_index];
    if (!candidate || candidate.mask !== 1 || candidateLabel(candidate) !== alternative.label) fail(`alternative ${index} label mismatch`);
    if (seen.has(alternative.candidate_index)) fail(`alternative ${index} duplicates candidate ${alternative.candidate_index}`);
    seen.add(alternative.candidate_index);
    if (alternative.advantage_waves !== alternative.wave_reached - record.reference_wave_reached) fail(`alternative ${index} advantage mismatch`);
  });
  if (!Array.isArray(record.failed_job_ids)) fail("failed_job_ids must be an array");
  return record;
}

// --- Pilot-Auswertung -------------------------------------------------------------------------------------------

export interface RolloutSummary {
  seeds: number;
  decisions: number;
  rollouts: number;
  failed_rollouts: number;
  reference_mean_wave: number;
  /** Anteil der Entscheidungen, bei denen mindestens eine Alternative eine spaetere Welle erreicht. */
  share_decisions_with_better_alternative: number;
  share_decisions_with_worse_only: number;
  share_decisions_all_tied: number;
  /** Mittlerer Gewinn der besten Alternative, nur ueber Entscheidungen mit besserer Alternative. */
  mean_gain_when_better: number;
  /**
   * Beste einzelne Abweichung pro Seed (max ueber alle Alternativen) minus Referenz, gemittelt: untere Schranke dessen,
   * was eine Policy mit Rollout-Wissen auf diesen Seeds erreicht (mehrere Abweichungen koennen mehr bringen).
   */
  mean_best_single_deviation_gain: number;
  by_family: Array<{ family: string; rollouts: number; mean_advantage: number; share_better: number; share_worse: number }>;
  by_wave_bucket: Array<{ bucket: string; decisions: number; share_with_better_alternative: number; mean_best_gain: number }>;
}

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function familyOfAlternative(record: RolloutRecord, alternative: RolloutRecordAlternative): string {
  const candidate = record.observation.candidates[alternative.candidate_index]!;
  return `${record.decision_stage}:${candidate.item_family ?? candidate.kind}`;
}

function waveBucket(wave: number): string {
  if (wave <= 5) return "01-05";
  if (wave <= 10) return "06-10";
  if (wave <= 20) return "11-20";
  return "21+";
}

export function summarizeRolloutRecords(records: readonly RolloutRecord[]): RolloutSummary {
  const seeds = new Map<string, { reference: number; best: number }>();
  const families = new Map<string, number[]>();
  const buckets = new Map<string, number[]>();
  let better = 0;
  let worseOnly = 0;
  let tied = 0;
  const gains: number[] = [];
  for (const record of records) {
    const best = Math.max(...record.alternatives.map(alternative => alternative.advantage_waves));
    const worst = Math.min(...record.alternatives.map(alternative => alternative.advantage_waves));
    if (best > 0) {
      better += 1;
      gains.push(best);
    } else if (best === 0 && worst === 0) {
      tied += 1;
    } else if (best < 0) {
      worseOnly += 1;
    }
    const seed = seeds.get(record.seed) ?? { reference: record.reference_wave_reached, best: 0 };
    seed.best = Math.max(seed.best, best);
    seeds.set(record.seed, seed);
    const bucket = waveBucket(record.wave_index);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), best]);
    for (const alternative of record.alternatives) {
      const family = familyOfAlternative(record, alternative);
      families.set(family, [...(families.get(family) ?? []), alternative.advantage_waves]);
    }
  }
  const rollouts = records.reduce((sum, record) => sum + record.alternatives.length, 0);
  return {
    seeds: seeds.size,
    decisions: records.length,
    rollouts,
    failed_rollouts: records.reduce((sum, record) => sum + record.failed_job_ids.length, 0),
    reference_mean_wave: mean([...seeds.values()].map(seed => seed.reference)),
    share_decisions_with_better_alternative: records.length > 0 ? better / records.length : 0,
    share_decisions_with_worse_only: records.length > 0 ? worseOnly / records.length : 0,
    share_decisions_all_tied: records.length > 0 ? tied / records.length : 0,
    mean_gain_when_better: mean(gains),
    mean_best_single_deviation_gain: mean([...seeds.values()].map(seed => seed.best)),
    by_family: [...families.entries()]
      .map(([family, values]) => ({
        family,
        rollouts: values.length,
        mean_advantage: mean(values),
        share_better: values.filter(value => value > 0).length / values.length,
        share_worse: values.filter(value => value < 0).length / values.length,
      }))
      .sort((a, b) => b.rollouts - a.rollouts),
    by_wave_bucket: [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, values]) => ({
        bucket,
        decisions: values.length,
        share_with_better_alternative: values.filter(value => value > 0).length / values.length,
        mean_best_gain: mean(values),
      })),
  };
}

export function formatRolloutSummary(summary: RolloutSummary): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)} %`;
  const lines = [
    `Seeds: ${summary.seeds}, Entscheidungen: ${summary.decisions}, Rollouts: ${summary.rollouts} (fehlgeschlagen: ${summary.failed_rollouts})`,
    `Referenz (heuristic_v1) mittlere Welle: ${summary.reference_mean_wave.toFixed(2)}`,
    `Entscheidungen mit besserer Alternative: ${pct(summary.share_decisions_with_better_alternative)}`
      + ` (mittlerer Gewinn dann ${summary.mean_gain_when_better.toFixed(2)} Wellen);`
      + ` nur schlechtere: ${pct(summary.share_decisions_with_worse_only)}; alle gleich: ${pct(summary.share_decisions_all_tied)}`,
    `Beste einzelne Abweichung pro Seed: +${summary.mean_best_single_deviation_gain.toFixed(2)} Wellen im Mittel`,
    "",
    "| Familie (Alternative) | Rollouts | Vorteil (Wellen) | besser | schlechter |",
    "|---|---:|---:|---:|---:|",
    ...summary.by_family.map(row =>
      `| ${row.family} | ${row.rollouts} | ${row.mean_advantage.toFixed(2)} | ${pct(row.share_better)} | ${pct(row.share_worse)} |`),
    "",
    "| Wellen | Entscheidungen | mit besserer Alternative | Gewinn der besten Alternative |",
    "|---|---:|---:|---:|",
    ...summary.by_wave_bucket.map(row =>
      `| ${row.bucket} | ${row.decisions} | ${pct(row.share_with_better_alternative)} | ${row.mean_best_gain.toFixed(2)} |`),
  ];
  return lines.join("\n");
}
