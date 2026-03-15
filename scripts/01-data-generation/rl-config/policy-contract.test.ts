import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validatePolicyConfig } from "./policy-contract.ts";
import { validateCollectorRunConfig, validateIterativePipelineConfig, validateRandomCollectionPipelineConfig } from "./run-config-contract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

test("accepts valid epsilon_random policy with nested external command exploit policy", () => {
  const policy = validatePolicyConfig({
    type: "epsilon_random",
    start_epsilon: 0.3,
    end_epsilon: 0.1,
    exploit_policy: {
      type: "external_command",
      command: ["python3", "worker.py"],
      timeout_ms: 15000,
      persistent: true,
    },
  });

  assert.equal(policy.type, "epsilon_random");
  assert.equal(policy.start_epsilon, 0.3);
  assert.equal(policy.exploit_policy.type, "external_command");
});

test("rejects legacy epsilon_start and epsilon_end fields", () => {
  assert.throws(
    () => validatePolicyConfig({
      type: "epsilon_random",
      epsilon_start: 0.3,
      epsilon_end: 0.1,
    }),
    /Use start_epsilon\/end_epsilon instead/,
  );
});

test("iterative pipeline configs use canonical epsilon field names", () => {
  for (const relativePath of [
    "data/rl/wave-library-iterative-pipeline-run.json",
    "data/rl/wave-library-iterative-pipeline-remote-smoke.json",
    "data/rl/wave-library-iterative-pipeline-remote-10ep.json",
  ]) {
    const configPath = path.join(repoRoot, relativePath);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    validateIterativePipelineConfig(config, {
      context: relativePath,
    });
  }
});

test("random-collection configs validate required collect and archive fields", () => {
  for (const relativePath of [
    "data/rl/wave-library-random-collection-remote-smoke.json",
    "data/rl/wave-library-random-collection-remote-50ep.json",
    "data/rl/wave-library-random-collection-remote-100ep.json",
    "data/rl/wave-library-random-collection-remote-v3-smoke.json",
    "data/rl/wave-library-random-collection-remote-v3-50ep.json",
  ]) {
    const configPath = path.join(repoRoot, relativePath);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    validateRandomCollectionPipelineConfig(config, {
      context: relativePath,
    });
  }
});

test("collector configs validate expected runtime fields", () => {
  for (const relativePath of [
    "data/rl/collector-run.json",
    "data/rl/collector-run-benchmarked-wave-library-v2-full.json",
    "data/rl/collector-run-wave-library-v2-smoke.json",
  ]) {
    const configPath = path.join(repoRoot, relativePath);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    validateCollectorRunConfig(config, {
      context: relativePath,
    });
  }
});
