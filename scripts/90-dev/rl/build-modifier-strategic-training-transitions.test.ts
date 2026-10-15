import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildModifierStrategicTrainingTransitions, rankScoresForSeed } from "./build-modifier-strategic-training-transitions.ts";

const exampleTransition = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../docs/rl-schema/modifier-transition-v1.example.json"),
    "utf8",
  ),
) as Record<string, unknown>;

function createWorkerOutput({
  workerId,
  seed,
  runIndex,
  waveReached,
  completedWaves = waveReached,
  stepCount = 2,
  localRewardSum = 0.1,
}: {
  workerId: string;
  seed: string;
  runIndex: number;
  waveReached: number;
  completedWaves?: number;
  stepCount?: number;
  localRewardSum?: number;
}) {
  return {
    schema_version: "modifier_strategic_fixed_seed_output_v2",
    seed,
    run_count: 1,
    max_waves: 11,
    collector_variant: "strategic_fixed_seed",
    worker_id: workerId,
    starter_config_id: "wave_lib_w1_starters_v1",
    starter_species: ["BULBASAUR", "CHARMANDER", "SQUIRTLE"],
    decision_rng_strategy: "seed_plus_run_index",
    step_timeout_ms: 15000,
    modifier_policy: "random_executable",
    max_shop_purchases_per_phase: 3,
    combat_dqn_checkpoint: "data/rl/models/example.pt",
    combat_dqn_device: "cpu",
    generated_at: "2026-03-19T00:00:00.000Z",
    summary: {
      average_wave_reached: waveReached,
      average_total_reward: waveReached,
      best_wave_reached: waveReached,
      worst_wave_reached: waveReached,
    },
    episodes: [
      {
        schema_version: "modifier_strategic_fixed_seed_output_v2",
        run_index: runIndex,
        worker_id: workerId,
        decision_rng_seed: `${seed}::${runIndex}`,
        seed,
        max_waves: 11,
        collector_variant: "strategic_fixed_seed",
        modifier_policy: "random_executable",
        runtime_ms: 1000,
        completed_waves: completedWaves,
        wave_reached: waveReached,
        termination_reason: "max_waves_reached",
        local_reward_sum: localRewardSum,
        terminal_reward: waveReached,
        total_reward: waveReached + localRewardSum,
        steps: Array.from({ length: stepCount }, (_, stepIndex) => ({
          step_index: stepIndex,
          worker_id: workerId,
          decision_rng_seed: `${seed}::${runIndex}`,
          wave_index: stepIndex + 1,
          combat_turns: [],
          modifier_transition: { ...structuredClone(exampleTransition), immediate_reward: 0.1 },
        })),
      },
    ],
  };
}

/** Erwarteter Score nach Definition: z-Score von ln(1 + Welle), Populations-Streuung. */
function expectedLogScores(waves: number[]): number[] {
  const logs = waves.map(wave => Math.log1p(wave));
  const mean = logs.reduce((sum, value) => sum + value, 0) / logs.length;
  const spread = Math.sqrt(logs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / logs.length);
  return logs.map(value => (value - mean) / spread);
}

test("buildModifierStrategicTrainingTransitions scores runs as seed-local z-scores of log waves", () => {
  const seed = "seed-a";
  const outputs = [
    createWorkerOutput({ workerId: "worker-0", seed, runIndex: 0, waveReached: 10, stepCount: 4 }),
    createWorkerOutput({ workerId: "worker-1", seed, runIndex: 1, waveReached: 7 }),
    createWorkerOutput({ workerId: "worker-2", seed, runIndex: 2, waveReached: 4 }),
  ];

  const transitions = buildModifierStrategicTrainingTransitions(outputs, { gamma: 0.99 });
  const scoreOf = (runIndex: number) => transitions.find(row => row.run_index === runIndex)?.rank_score;
  const expected = expectedLogScores([10, 7, 4]);
  [0, 1, 2].forEach(runIndex => assert.ok(Math.abs(scoreOf(runIndex)! - expected[runIndex]!) < 1e-12));
  assert.ok(transitions.every(row => row.seed_run_count === 3));
  // Jeder Schritt eines Runs bekommt denselben Score; das Gewicht ist 1 / Schritte des Runs.
  const run0 = transitions.filter(row => row.run_index === 0);
  assert.ok(run0.every(row => row.rank_score === scoreOf(0) && row.run_weight === 0.25));
  assert.ok(transitions.filter(row => row.run_index === 1).every(row => row.run_weight === 0.5));
});

test("rankScoresForSeed weights early waves more than late waves", () => {
  // Gleicher Abstand in Wellen, aber 7 -> 8 liegt auf der Log-Skala weiter auseinander als 23 -> 24.
  const early = rankScoresForSeed([7, 8, 15]);
  const late = rankScoresForSeed([7, 23, 24]);
  assert.ok(early[1]! - early[0]! > late[2]! - late[1]!);
});

test("rankScoresForSeed gives ties the same score regardless of the shaped reward", () => {
  assert.deepEqual(rankScoresForSeed([6, 6, 6]), [0, 0, 0]);
  const [a, b, c] = rankScoresForSeed([8, 8, 2]);
  assert.equal(a, b);
  assert.ok(a! > 0 && c! < 0);
});

test("rankScoresForSeed floors the log spread and clips to [-3, 3]", () => {
  // Eine Welle Unterschied auf hohem Niveau: Log-Streuung ~0.02 wird auf 0.1 angehoben.
  const [low, high] = rankScoresForSeed([40, 41]);
  const halfGap = (Math.log1p(41) - Math.log1p(40)) / 2;
  assert.ok(Math.abs(high! - halfGap / 0.1) < 1e-12);
  assert.ok(Math.abs(low! + halfGap / 0.1) < 1e-12);
  // Ein Ausreisser unter vielen gleichen Runs wird gekappt.
  const scores = rankScoresForSeed([30, ...Array.from({ length: 30 }, () => 5)]);
  assert.equal(scores[0], 3);
  assert.ok(scores.slice(1).every(score => score < 0 && score > -1));
  assert.deepEqual(rankScoresForSeed([9]), [0]);
});

test("buildModifierStrategicTrainingTransitions ignores local_reward_sum for the rank score", () => {
  const outputs = [
    createWorkerOutput({ workerId: "worker-0", seed: "seed-tie", runIndex: 0, waveReached: 6, localRewardSum: 3 }),
    createWorkerOutput({ workerId: "worker-1", seed: "seed-tie", runIndex: 1, waveReached: 6, localRewardSum: 0 }),
  ];
  const transitions = buildModifierStrategicTrainingTransitions(outputs);
  assert.ok(transitions.every(row => row.rank_score === 0 && row.posthoc_credit === 0));
});

test("buildModifierStrategicTrainingTransitions applies discounting by distance to end", () => {
  const outputs = [
    createWorkerOutput({ workerId: "worker-0", seed: "seed-discount", runIndex: 0, waveReached: 8, stepCount: 3 }),
    createWorkerOutput({ workerId: "worker-1", seed: "seed-discount", runIndex: 1, waveReached: 2, stepCount: 3 }),
  ];

  const transitions = buildModifierStrategicTrainingTransitions(outputs, { gamma: 0.5 });
  const run0 = transitions.filter(row => row.seed === "seed-discount" && row.run_index === 0);

  assert.equal(run0[0]?.distance_to_end, 2);
  assert.equal(run0[0]?.discount_factor, 0.25);
  assert.equal(run0[0]?.posthoc_credit, 0.25);
  assert.equal(run0[1]?.distance_to_end, 1);
  assert.equal(run0[1]?.discount_factor, 0.5);
  assert.equal(run0[1]?.posthoc_credit, 0.5);
  assert.equal(run0[2]?.distance_to_end, 0);
  assert.equal(run0[2]?.discount_factor, 1);
  assert.equal(run0[2]?.posthoc_credit, 1);
});

test("buildModifierStrategicTrainingTransitions carries modifier-v1 state and candidates", () => {
  const transitions = buildModifierStrategicTrainingTransitions([
    createWorkerOutput({ workerId: "worker-0", seed: "seed-v1", runIndex: 0, waveReached: 4, stepCount: 1 }),
  ]);

  assert.equal(transitions.length, 1);
  assert.equal(transitions[0]?.schema_version, "modifier_training_transition_v4");
  assert.equal(transitions[0]?.run_weight, 1);
  assert.equal(transitions[0]?.seed_run_count, 1);
  assert.equal(transitions[0]?.rank_score, 0);
  assert.equal(transitions[0]?.decision_stage, exampleTransition.decision_stage);
  assert.deepEqual(transitions[0]?.state, exampleTransition.state);
  assert.deepEqual(transitions[0]?.candidates, exampleTransition.candidates);
  assert.equal(transitions[0]?.selected_candidate_index, exampleTransition.selected_candidate_index);
  assert.equal(transitions[0]?.immediate_reward, 0.1);
});

test("buildModifierStrategicTrainingTransitions rejects duplicate seed/run combinations", () => {
  const duplicateA = createWorkerOutput({ workerId: "worker-a", seed: "seed-dup", runIndex: 0, waveReached: 5 });
  const duplicateB = createWorkerOutput({ workerId: "worker-b", seed: "seed-dup", runIndex: 0, waveReached: 7 });

  assert.throws(
    () => buildModifierStrategicTrainingTransitions([duplicateA, duplicateB]),
    /Duplicate run identity detected/,
  );
});

function createAllTechnicalWorkerOutput(seed: string, runIndex: number) {
  return {
    schema_version: "unknown",
    seed,
    run_count: 1,
    max_waves: 11,
    collector_variant: "strategic_fixed_seed",
    worker_id: "unknown",
    starter_config_id: "unknown",
    starter_species: [],
    decision_rng_strategy: "seed_plus_run_index",
    step_timeout_ms: 15000,
    modifier_policy: "random_executable",
    combat_dqn_checkpoint: "data/rl/models/example.pt",
    combat_dqn_device: "cpu",
    generated_at: "2026-10-12T00:00:00.000Z",
    summary: {
      average_wave_reached: null,
      average_total_reward: null,
      best_wave_reached: null,
      worst_wave_reached: null,
    },
    episodes: [],
    regular_run_count: 0,
    technical_termination_count: 1,
    technical_terminations: [
      {
        run_index: runIndex,
        kind: "collector_run_process_timeout",
        reason: "run_process_timeout_ms_exceeded:3000",
        exit_code: null,
        signal: "SIGKILL",
        episode: null,
      },
    ],
  };
}

test("buildModifierStrategicTrainingTransitions ignores technical terminations and seeds without regular runs", () => {
  const regular = createWorkerOutput({ workerId: "w1", seed: "seed-a", runIndex: 0, waveReached: 5 });
  const mixed = {
    ...createWorkerOutput({ workerId: "w1", seed: "seed-a", runIndex: 1, waveReached: 3 }),
    regular_run_count: 1,
    technical_termination_count: 1,
    technical_terminations: [
      { run_index: 2, kind: "collector_run_technical_termination", reason: "step_timeout", exit_code: 0, signal: null, episode: null },
    ],
  };
  const onlyTechnical = createAllTechnicalWorkerOutput("seed-b", 0);

  const transitions = buildModifierStrategicTrainingTransitions([regular, mixed, onlyTechnical]);

  assert.deepEqual(Array.from(new Set(transitions.map(entry => entry.seed))), ["seed-a"]);
  assert.deepEqual(Array.from(new Set(transitions.map(entry => entry.run_index))).sort(), [0, 1]);
  // Score nur ueber die beiden regulaeren Runs von seed-a (Wellen 5 und 3): bei zwei Runs immer +1 bzw. -1.
  assert.ok(Math.abs(transitions.find(entry => entry.run_index === 0)!.rank_score - 1) < 1e-12);
  assert.ok(Math.abs(transitions.find(entry => entry.run_index === 1)!.rank_score + 1) < 1e-12);
});

test("buildModifierStrategicTrainingTransitions returns no transitions when every run was technical", () => {
  assert.deepEqual(buildModifierStrategicTrainingTransitions([createAllTechnicalWorkerOutput("seed-b", 0)]), []);
});
