import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  DEFAULT_CIRCUIT_BREAKER,
  TechnicalFailureCircuitBreaker,
  groupTechnicalFailures,
  loadTechnicalFailures,
  resolveCircuitBreakerConfig,
  writeTechnicalFailureFile,
  writeTechnicalFailureSignatures,
  type TechnicalFailure,
} from "./technical-failures.ts";

function createFailure(overrides: Partial<TechnicalFailure> = {}): TechnicalFailure {
  return {
    schema_version: 1,
    pipeline: "modifier_strategic_seeded",
    failure_id: "seed-1--run-0",
    batch_id: "seed-1--batch-001",
    kind: "collector_run_technical_termination",
    reason: "step_timeout",
    seed: "seed-1",
    run_index: 0,
    scenario: null,
    wave: 7,
    phase: "CommandPhase",
    ui_mode: "COMMAND",
    is_double_battle: false,
    repro: { command: "node repro.ts seed-1 0", params: {} },
    commits: { repo: "abc", submodule: "def" },
    recorded_at: "2026-10-12T00:00:00.000Z",
    detail: null,
    ...overrides,
  };
}

test("circuit breaker defaults match the ticket decision", () => {
  assert.deepEqual(resolveCircuitBreakerConfig(undefined), { max_consecutive: 5, max_ratio: 0.2, min_runs_for_ratio: 20 });
  assert.deepEqual(resolveCircuitBreakerConfig({ max_consecutive: 3 }), { ...DEFAULT_CIRCUIT_BREAKER, max_consecutive: 3 });
  assert.throws(() => resolveCircuitBreakerConfig({ max_ratio: 1.5 }), /max_ratio/);
  assert.throws(() => resolveCircuitBreakerConfig({ unknown: 1 }), /Unknown key/);
});

test("circuit breaker trips after max_consecutive technical runs in a row", () => {
  const breaker = new TechnicalFailureCircuitBreaker();
  for (let index = 0; index < 4; index += 1) {
    breaker.record("technical");
  }
  breaker.record("regular");
  for (let index = 0; index < 4; index += 1) {
    breaker.record("technical");
  }
  assert.equal(breaker.tripped, false, "a regular run resets the consecutive counter");
  breaker.record("technical");
  assert.equal(breaker.tripped, true);
  assert.match(breaker.trippedReason ?? "", /^technical_failure_threshold_exceeded:consecutive=5>=5$/);
});

test("circuit breaker trips on the ratio only after min_runs_for_ratio runs", () => {
  const breaker = new TechnicalFailureCircuitBreaker();
  // Muster T R R: 33 % technisch, aber nie 5 in Folge.
  for (let index = 0; index < 19; index += 1) {
    breaker.record(index % 3 === 0 ? "technical" : "regular");
  }
  assert.equal(breaker.totalRuns, 19);
  assert.equal(breaker.tripped, false, "ratio is not evaluated before 20 runs");
  breaker.record("regular");
  assert.equal(breaker.tripped, true);
  assert.match(breaker.trippedReason ?? "", /^technical_failure_threshold_exceeded:ratio=7\/20>0.2$/);
});

test("circuit breaker stays quiet at exactly the allowed ratio", () => {
  const breaker = new TechnicalFailureCircuitBreaker();
  for (let index = 0; index < 20; index += 1) {
    breaker.record(index % 5 === 0 ? "technical" : "regular");
  }
  assert.equal(breaker.snapshot().technical_ratio, 0.2);
  assert.equal(breaker.tripped, false);
});

test("failures are grouped by kind, reason, phase, ui mode and battle type", () => {
  const signatures = groupTechnicalFailures([
    createFailure({ failure_id: "seed-1--run-0", seed: "seed-1", wave: 7 }),
    createFailure({ failure_id: "seed-2--run-3", seed: "seed-2", wave: 12, repro: { command: "node repro.ts seed-2 3", params: {} } }),
    createFailure({ failure_id: "seed-2--run-4", seed: "seed-2", is_double_battle: true }),
    createFailure({ failure_id: "seed-3--run-0", seed: "seed-3", phase: "DamageAnimPhase", ui_mode: "MESSAGE" }),
  ]);

  assert.equal(signatures.length, 3);
  const [largest] = signatures;
  assert.equal(largest!.count, 2);
  assert.equal(largest!.signature, "collector_run_technical_termination|step_timeout|CommandPhase|COMMAND|single");
  assert.deepEqual(largest!.seeds, ["seed-1", "seed-2"]);
  assert.equal(largest!.wave_min, 7);
  assert.equal(largest!.wave_max, 12);
  assert.equal(largest!.example_failure_id, "seed-1--run-0");
  assert.equal(largest!.example_repro_command, "node repro.ts seed-1 0");
});

test("failure files round-trip and feed the signature file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "technical-failures-"));
  try {
    const failuresDir = path.join(dir, "technical-failures");
    writeTechnicalFailureFile(failuresDir, createFailure({ failure_id: "seed/1--run-0" }));
    writeTechnicalFailureFile(failuresDir, createFailure({ failure_id: "seed-2--run-1", reason: "missing_run_output" }));
    const loaded = loadTechnicalFailures(failuresDir);
    assert.equal(loaded.length, 2);

    const payload = writeTechnicalFailureSignatures(path.join(dir, "technical-failure-signatures.json"), loaded);
    assert.equal(payload.technical_failure_count, 2);
    assert.equal(payload.signature_count, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
