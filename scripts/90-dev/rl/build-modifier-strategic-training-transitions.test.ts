import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModifierStrategicTrainingTransitions } from "./build-modifier-strategic-training-transitions.ts";

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
    schema_version: "modifier_strategic_fixed_seed_output_v1",
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
        schema_version: "modifier_strategic_fixed_seed_output_v1",
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
          modifier_decision: {
            wave_index: stepIndex + 1,
            reward_options: [],
            shop_rows: [],
            actions: [],
            action_mask: [1, 0, 1],
          },
          selected_action: {
            action_index: stepIndex % 2 === 0 ? 0 : 2,
            action_type: "take_reward",
            modifier_type_id: stepIndex % 2 === 0 ? "LURE" : "POKEBALL",
            cost: 0,
            available: true,
            executable: true,
          },
          selected_action_valid: true,
          immediate_reward: 0.1,
        })),
      },
    ],
  };
}

test("buildModifierStrategicTrainingTransitions ranks runs within the same seed", () => {
  const seed = "seed-a";
  const outputs = [
    createWorkerOutput({ workerId: "worker-0", seed, runIndex: 0, waveReached: 10 }),
    createWorkerOutput({ workerId: "worker-1", seed, runIndex: 1, waveReached: 7 }),
    createWorkerOutput({ workerId: "worker-2", seed, runIndex: 2, waveReached: 3 }),
  ];

  const transitions = buildModifierStrategicTrainingTransitions(outputs, { gamma: 0.99 });
  const run0 = transitions.filter(row => row.seed === seed && row.run_index === 0);
  const run1 = transitions.filter(row => row.seed === seed && row.run_index === 1);
  const run2 = transitions.filter(row => row.seed === seed && row.run_index === 2);

  assert.ok(run0.every(row => row.rank_score === 1));
  assert.ok(run1.every(row => row.rank_score === 0));
  assert.ok(run2.every(row => row.rank_score === -1));
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

test("buildModifierStrategicTrainingTransitions rejects duplicate seed/run combinations", () => {
  const duplicateA = createWorkerOutput({ workerId: "worker-a", seed: "seed-dup", runIndex: 0, waveReached: 5 });
  const duplicateB = createWorkerOutput({ workerId: "worker-b", seed: "seed-dup", runIndex: 0, waveReached: 7 });

  assert.throws(
    () => buildModifierStrategicTrainingTransitions([duplicateA, duplicateB]),
    /Duplicate run identity detected/,
  );
});
