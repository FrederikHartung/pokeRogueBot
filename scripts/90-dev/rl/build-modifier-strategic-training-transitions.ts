import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateModifierStrategicFixedSeedOutput } from "./modifier-strategic-fixed-seed-contract.ts";

/**
 * v2: State und Kandidaten aus modifier-transition-v1 statt Positions-Maske.
 * v3: stetiger seed-lokaler rank_score (z-Score von wave_reached) statt +1/0/-1, dazu seed_run_count.
 * v4: z-Score auf ln(1 + wave_reached) statt auf der Welle, Kappung +-3, dazu run_weight.
 */
export const MODIFIER_TRAINING_TRANSITION_SCHEMA_VERSION = "modifier_training_transition_v4";

/** rank_score wird auf [-RANK_SCORE_CLIP, RANK_SCORE_CLIP] gekappt (docs/modifier-state-v1-draft.md, Abschnitt 5). */
export const RANK_SCORE_CLIP = 3;

/**
 * Untergrenze der Streuung auf der Log-Skala. 0,1 entspricht rund einer Welle Unterschied um Welle 8-10 und verhindert,
 * dass fast gleiche Runs auf die Kappung aufgeblasen werden.
 */
export const RANK_SCORE_MIN_LOG_SPREAD = 0.1;

export interface PostprocessOptions {
  gamma?: number;
}

export interface ModifierTrainingTransition {
  schema_version: string;
  training_schema_version: string;
  collector_schema_version: string;
  collector_variant: string;
  seed: string;
  run_index: number;
  worker_id: string;
  step_index: number;
  wave_index: number;
  starter_config_id: string;
  combat_dqn_checkpoint: string;
  decision_rng_seed: string;
  decision_rng_strategy: string;
  decision_stage: string;
  state: Record<string, unknown>;
  candidates: Array<Record<string, unknown>>;
  selected_candidate_index: number;
  immediate_reward: number;
  wave_reached: number;
  termination_reason: string;
  rank_score: number;
  /** Regulaere Runs dieses Seeds; bei 1 ist rank_score immer 0 und traegt kein Signal. */
  seed_run_count: number;
  /** 1 / Anzahl Schritte des Runs: im Training zaehlt so jeder Run gleich viel, unabhaengig von seiner Laenge. */
  run_weight: number;
  distance_to_end: number;
  discount_factor: number;
  posthoc_credit: number;
}

interface NormalizedEpisode {
  schema_version: string;
  collector_variant: string;
  seed: string;
  run_index: number;
  worker_id: string;
  decision_rng_seed: string;
  wave_reached: number;
  termination_reason: string;
  steps: Array<Record<string, unknown>>;
  starter_config_id: string;
  combat_dqn_checkpoint: string;
  decision_rng_strategy: string;
}

interface NormalizedOutput {
  schema_version: string;
  collector_variant: string;
  worker_id: string;
  starter_config_id: string;
  combat_dqn_checkpoint: string;
  decision_rng_strategy: string;
  episodes: NormalizedEpisode[];
}

function groupBySeed<T extends { seed: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const existing = grouped.get(item.seed);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.seed, [item]);
    }
  }
  return grouped;
}

function assertCompatibleOutputs(outputs: NormalizedOutput[]): void {
  if (outputs.length === 0) {
    throw new Error("Expected at least one worker output");
  }

  const first = outputs[0]!;
  for (const output of outputs.slice(1)) {
    if (output.schema_version !== first.schema_version) {
      throw new Error(`Mismatched schema_version: ${output.schema_version} vs ${first.schema_version}`);
    }
    if (output.collector_variant !== first.collector_variant) {
      throw new Error(`Mismatched collector_variant: ${output.collector_variant} vs ${first.collector_variant}`);
    }
    if (output.starter_config_id !== first.starter_config_id) {
      throw new Error(`Mismatched starter_config_id: ${output.starter_config_id} vs ${first.starter_config_id}`);
    }
    if (output.combat_dqn_checkpoint !== first.combat_dqn_checkpoint) {
      throw new Error(`Mismatched combat_dqn_checkpoint: ${output.combat_dqn_checkpoint} vs ${first.combat_dqn_checkpoint}`);
    }
    if (output.decision_rng_strategy !== first.decision_rng_strategy) {
      throw new Error(`Mismatched decision_rng_strategy: ${output.decision_rng_strategy} vs ${first.decision_rng_strategy}`);
    }
  }
}

function normalizeWorkerOutput(value: unknown): NormalizedOutput {
  const normalized = validateModifierStrategicFixedSeedOutput(value) as Record<string, unknown>;
  const collectorVariant = String(normalized.collector_variant);
  const schemaVersion = String(normalized.schema_version);
  const starterConfigId = String(normalized.starter_config_id);
  const combatDqnCheckpoint = String(normalized.combat_dqn_checkpoint);
  const decisionRngStrategy = String(normalized.decision_rng_strategy);
  const defaultWorkerId = String(normalized.worker_id);

  const episodes = (normalized.episodes as Array<Record<string, unknown>>).map(episode => ({
    schema_version: String(episode.schema_version),
    collector_variant: String(episode.collector_variant),
    seed: String(episode.seed),
    run_index: Number(episode.run_index),
    worker_id: String(episode.worker_id ?? defaultWorkerId),
    decision_rng_seed: String(episode.decision_rng_seed),
    wave_reached: Number(episode.wave_reached),
    termination_reason: String(episode.termination_reason),
    steps: (episode.steps as Array<Record<string, unknown>>).map(step => structuredClone(step)),
    starter_config_id: starterConfigId,
    combat_dqn_checkpoint: combatDqnCheckpoint,
    decision_rng_strategy: decisionRngStrategy,
  }));

  return {
    schema_version: schemaVersion,
    collector_variant: collectorVariant,
    worker_id: defaultWorkerId,
    starter_config_id: starterConfigId,
    combat_dqn_checkpoint: combatDqnCheckpoint,
    decision_rng_strategy: decisionRngStrategy,
    episodes,
  };
}

function assertNoDuplicateRuns(episodes: NormalizedEpisode[]): void {
  const seen = new Set<string>();
  for (const episode of episodes) {
    const key = `${episode.seed}::${episode.run_index}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate run identity detected: ${key}`);
    }
    seen.add(key);
  }
}

/**
 * Seed-lokaler stetiger Score: z-Score von ln(1 + wave_reached) ueber die Runs desselben Seeds, gekappt auf [-3, 3].
 * Die Log-Skala gewichtet fruehe Wellen staerker (Welle 7 -> 8 zaehlt mehr als 23 -> 24) und macht die schiefe
 * Verteilung (viele fruehe Tode, wenige weite Runs) symmetrischer. Gleichstaende bekommen denselben Wert; der geshapte
 * Sofort-Reward beeinflusst den Score nicht.
 */
export function rankScoresForSeed(wavesReached: number[]): number[] {
  if (wavesReached.length === 0) {
    return [];
  }
  const logWaves = wavesReached.map(wave => Math.log1p(Math.max(0, wave)));
  const mean = logWaves.reduce((sum, value) => sum + value, 0) / logWaves.length;
  const variance = logWaves.reduce((sum, value) => sum + (value - mean) ** 2, 0) / logWaves.length;
  const scale = Math.max(Math.sqrt(variance), RANK_SCORE_MIN_LOG_SPREAD);
  return logWaves.map(value => {
    const score = (value - mean) / scale;
    // +0 statt -0, damit JSON und Gleichheitsvergleiche stabil bleiben.
    return Math.min(RANK_SCORE_CLIP, Math.max(-RANK_SCORE_CLIP, score)) + 0;
  });
}

function buildTransition(
  episode: NormalizedEpisode,
  step: Record<string, unknown>,
  rankScore: number,
  seedRunCount: number,
  gamma: number,
  collectorSchemaVersion: string,
): ModifierTrainingTransition {
  const stepIndex = Number(step.step_index);
  // modifier-transition-v1 (docs/rl-schema/modifier-transition-v1.schema.json), vom Contract bereits validiert.
  const transition = step.modifier_transition as Record<string, unknown>;
  const lastStepIndex = episode.steps.length - 1;
  const distanceToEnd = Math.max(0, lastStepIndex - stepIndex);
  const discountFactor = Math.pow(gamma, distanceToEnd);

  return {
    schema_version: MODIFIER_TRAINING_TRANSITION_SCHEMA_VERSION,
    training_schema_version: MODIFIER_TRAINING_TRANSITION_SCHEMA_VERSION,
    collector_schema_version: collectorSchemaVersion,
    collector_variant: episode.collector_variant,
    seed: episode.seed,
    run_index: episode.run_index,
    worker_id: String(step.worker_id),
    step_index: stepIndex,
    wave_index: Number(step.wave_index),
    starter_config_id: episode.starter_config_id,
    combat_dqn_checkpoint: episode.combat_dqn_checkpoint,
    decision_rng_seed: String(step.decision_rng_seed),
    decision_rng_strategy: episode.decision_rng_strategy,
    decision_stage: String(transition.decision_stage),
    state: structuredClone(transition.state as Record<string, unknown>),
    candidates: structuredClone(transition.candidates as Array<Record<string, unknown>>),
    selected_candidate_index: Number(transition.selected_candidate_index),
    immediate_reward: Number(transition.immediate_reward),
    wave_reached: episode.wave_reached,
    termination_reason: episode.termination_reason,
    rank_score: rankScore,
    seed_run_count: seedRunCount,
    run_weight: 1 / episode.steps.length,
    distance_to_end: distanceToEnd,
    discount_factor: discountFactor,
    posthoc_credit: rankScore * discountFactor,
  };
}

export function buildModifierStrategicTrainingTransitions(
  rawWorkerOutputs: unknown[],
  options: PostprocessOptions = {},
): ModifierTrainingTransition[] {
  const gamma = options.gamma ?? 0.99;
  if (typeof gamma !== "number" || !Number.isFinite(gamma) || gamma <= 0 || gamma > 1) {
    throw new Error(`Invalid gamma: ${String(gamma)}`);
  }

  // Ausgaben ohne regulaere Episode (jeder Run technisch beendet) tragen nichts zum Datensatz bei
  // und haben keine verlaesslichen Metadaten; technische Runs selbst stehen nie in episodes[].
  const outputs = rawWorkerOutputs.map(normalizeWorkerOutput).filter(output => output.episodes.length > 0);
  if (outputs.length === 0) {
    return [];
  }
  assertCompatibleOutputs(outputs);

  const collectorSchemaVersion = outputs[0]!.schema_version;
  const episodes = outputs.flatMap(output => output.episodes);
  assertNoDuplicateRuns(episodes);

  const transitions: ModifierTrainingTransition[] = [];
  for (const [, seedEpisodes] of groupBySeed(episodes)) {
    const rankScores = rankScoresForSeed(seedEpisodes.map(episode => episode.wave_reached));
    seedEpisodes.forEach((episode, index) => {
      for (const step of episode.steps) {
        transitions.push(buildTransition(episode, step, rankScores[index]!, seedEpisodes.length, gamma, collectorSchemaVersion));
      }
    });
  }

  transitions.sort((left, right) => {
    if (left.seed !== right.seed) {
      return left.seed.localeCompare(right.seed);
    }
    if (left.run_index !== right.run_index) {
      return left.run_index - right.run_index;
    }
    return left.step_index - right.step_index;
  });

  return transitions;
}

function loadJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJsonlFile(filePath: string, rows: ModifierTrainingTransition[]): void {
  const payload = rows.map(row => JSON.stringify(row)).join("\n") + "\n";
  writeFileSync(filePath, payload, "utf8");
}

function printUsage(): void {
  console.log(
    "Usage: node scripts/90-dev/rl/build-modifier-strategic-training-transitions.ts"
    + " <output-jsonl-path> <worker-output-1.json> [worker-output-2.json ...] [--gamma <0..1>]",
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const positional: string[] = [];
  let gamma = 0.99;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--gamma") {
      const next = args[index + 1];
      if (next == null) {
        throw new Error("Missing value for --gamma");
      }
      gamma = Number(next);
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  if (positional.length < 2) {
    printUsage();
    process.exit(1);
  }

  const [outputPath, ...inputPaths] = positional;
  const rawOutputs = inputPaths.map(loadJsonFile);
  const transitions = buildModifierStrategicTrainingTransitions(rawOutputs, { gamma });
  writeJsonlFile(path.resolve(outputPath), transitions);

  console.log("Modifier strategic training transitions:", path.resolve(outputPath));
  console.log("Input worker outputs:", inputPaths.length);
  console.log("Transitions written:", transitions.length);
  console.log("Gamma:", gamma);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
