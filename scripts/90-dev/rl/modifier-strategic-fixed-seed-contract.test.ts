import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { validateModifierStrategicFixedSeedOutput } from "./modifier-strategic-fixed-seed-contract.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function runStrategicCollector(outputPath: string, {
  seed,
  runCount = "1",
  maxWaves = "1",
  workerId = "contract-test-worker-0",
}: {
  seed: string;
  runCount?: string;
  maxWaves?: string;
  workerId?: string;
}): { payload: Record<string, unknown>; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    [
      "scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts",
      outputPath,
      seed,
      runCount,
      maxWaves,
      "random_executable",
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        POKEROGUE_COLLECTOR_WORKER_ID: workerId,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, `Collector run failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  const payload = JSON.parse(readFileSync(outputPath, "utf8")) as Record<string, unknown>;
  return { payload, stdout: result.stdout, stderr: result.stderr };
}

test("modifier strategic fixed-seed example matches the contract", () => {
  const examplePath = path.join(repoRoot, "docs", "rl-schema", "modifier-strategic-fixed-seed-output.example.json");
  const payload = JSON.parse(readFileSync(examplePath, "utf8"));
  assert.doesNotThrow(() => validateModifierStrategicFixedSeedOutput(payload));
});

test("modifier strategic fixed-seed contract accepts optional episode debug fields", () => {
  const examplePath = path.join(repoRoot, "docs", "rl-schema", "modifier-strategic-fixed-seed-output.example.json");
  const payload = JSON.parse(readFileSync(examplePath, "utf8")) as Record<string, unknown>;
  const episode = ((payload.episodes as Array<Record<string, unknown>>)[0])!;
  episode.retry_count = 1;
  episode.error_debug = { phase_name: "TitlePhase" };
  episode.timeout_debug = { phase_name: "CommandPhase" };
  episode.error_stack = "Error: example";

  assert.doesNotThrow(() => validateModifierStrategicFixedSeedOutput(payload));
});

test("strategic fixed-seed collector smoke output matches the contract", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "modifier-strategic-contract-"));
  const outputPath = path.join(tempDir, "collector-output.json");
  try {
    const { payload } = runStrategicCollector(outputPath, {
      seed: "modifier-strategic-contract-smoke",
      runCount: "1",
      maxWaves: "1",
      workerId: "contract-test-worker-0",
    });
    const normalized = validateModifierStrategicFixedSeedOutput(payload);

    assert.equal(normalized.worker_id, "contract-test-worker-0");
    assert.equal(normalized.schema_version, "modifier_strategic_fixed_seed_output_v1");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("strategic fixed-seed collector keeps modifier decisions deterministic for identical seed and run index", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "modifier-strategic-determinism-"));
  const outputPathA = path.join(tempDir, "collector-output-a.json");
  const outputPathB = path.join(tempDir, "collector-output-b.json");
  try {
    const runA = runStrategicCollector(outputPathA, {
      seed: "modifier-strategic-determinism",
      runCount: "1",
      maxWaves: "3",
      workerId: "worker-a",
    });
    const runB = runStrategicCollector(outputPathB, {
      seed: "modifier-strategic-determinism",
      runCount: "1",
      maxWaves: "3",
      workerId: "worker-b",
    });

    const payloadA = validateModifierStrategicFixedSeedOutput(runA.payload);
    const payloadB = validateModifierStrategicFixedSeedOutput(runB.payload);

    const episodeA = (payloadA.episodes as Array<Record<string, unknown>>)[0]!;
    const episodeB = (payloadB.episodes as Array<Record<string, unknown>>)[0]!;

    assert.equal(episodeA.decision_rng_seed, "modifier-strategic-determinism::0");
    assert.equal(episodeB.decision_rng_seed, "modifier-strategic-determinism::0");

    const selectedActionsA = ((episodeA.steps as Array<Record<string, unknown>>)).map(
      step => (step.selected_action as Record<string, unknown>).action_index,
    );
    const selectedActionsB = ((episodeB.steps as Array<Record<string, unknown>>)).map(
      step => (step.selected_action as Record<string, unknown>).action_index,
    );

    assert.deepEqual(selectedActionsA, selectedActionsB);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
