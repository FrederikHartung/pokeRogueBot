import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateModifierStrategicFixedSeedOutput } from "./modifier-strategic-fixed-seed-contract.ts";

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
  state: Record<string, unknown>;
  action_mask: number[];
  selected_action: Record<string, unknown>;
  selected_action_index: number;
  selected_action_valid: boolean;
  immediate_reward: number;
  wave_reached: number;
  termination_reason: string;
  rank_score: number;
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
  completed_waves: number;
  termination_reason: string;
  local_reward_sum: number;
  total_reward: number;
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
    completed_waves: Number(episode.completed_waves),
    termination_reason: String(episode.termination_reason),
    local_reward_sum: Number(episode.local_reward_sum),
    total_reward: Number(episode.total_reward),
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

function rankEpisodesForSeed(episodes: NormalizedEpisode[]): Array<{ episode: NormalizedEpisode; rank_score: number }> {
  const sorted = [...episodes].sort((left, right) => {
    if (right.wave_reached !== left.wave_reached) {
      return right.wave_reached - left.wave_reached;
    }
    if (right.completed_waves !== left.completed_waves) {
      return right.completed_waves - left.completed_waves;
    }
    if (right.local_reward_sum !== left.local_reward_sum) {
      return right.local_reward_sum - left.local_reward_sum;
    }
    return left.run_index - right.run_index;
  });

  if (sorted.length === 1) {
    return [{ episode: sorted[0]!, rank_score: 0 }];
  }

  const edgeBucketSize = Math.max(1, Math.floor(sorted.length * 0.2));
  const lastBottomIndex = sorted.length - edgeBucketSize;

  return sorted.map((episode, index) => {
    if (index < edgeBucketSize && index < lastBottomIndex) {
      return { episode, rank_score: 1 };
    }
    if (index >= lastBottomIndex && index >= edgeBucketSize) {
      return { episode, rank_score: -1 };
    }
    return { episode, rank_score: 0 };
  });
}

function buildTransition(
  episode: NormalizedEpisode,
  step: Record<string, unknown>,
  rankScore: number,
  gamma: number,
  collectorSchemaVersion: string,
): ModifierTrainingTransition {
  const stepIndex = Number(step.step_index);
  const selectedAction = step.selected_action as Record<string, unknown>;
  const modifierDecision = step.modifier_decision as Record<string, unknown>;
  const actionMask = Array.isArray(modifierDecision.action_mask) ? (modifierDecision.action_mask as number[]) : [];
  const selectedActionIndex = Number(selectedAction.action_index);
  const lastStepIndex = episode.steps.length - 1;
  const distanceToEnd = Math.max(0, lastStepIndex - stepIndex);
  const discountFactor = Math.pow(gamma, distanceToEnd);

  return {
    schema_version: "modifier_training_transition_v1",
    training_schema_version: "modifier_training_transition_v1",
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
    state: structuredClone(modifierDecision),
    action_mask: [...actionMask],
    selected_action: structuredClone(selectedAction),
    selected_action_index: selectedActionIndex,
    selected_action_valid: Boolean(step.selected_action_valid),
    immediate_reward: Number(step.immediate_reward),
    wave_reached: episode.wave_reached,
    termination_reason: episode.termination_reason,
    rank_score: rankScore,
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

  const outputs = rawWorkerOutputs.map(normalizeWorkerOutput);
  assertCompatibleOutputs(outputs);

  const collectorSchemaVersion = outputs[0]!.schema_version;
  const episodes = outputs.flatMap(output => output.episodes);
  assertNoDuplicateRuns(episodes);

  const transitions: ModifierTrainingTransition[] = [];
  for (const [, seedEpisodes] of groupBySeed(episodes)) {
    const rankedEpisodes = rankEpisodesForSeed(seedEpisodes);
    for (const { episode, rank_score } of rankedEpisodes) {
      for (const step of episode.steps) {
        transitions.push(buildTransition(episode, step, rank_score, gamma, collectorSchemaVersion));
      }
    }
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
