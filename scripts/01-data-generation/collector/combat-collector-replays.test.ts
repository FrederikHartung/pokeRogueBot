// Replay-Tests fuer zwei Combat-Collector-Fehler nach dem Submodul-Bump auf v1.12.0.10.
//
// Beide Fehler steckten im Collector-Code dieses Repos (generierter Test-String bzw. Helper-Template),
// nicht im Submodul. Deshalb laufen die Replays hier gegen den echten Collector statt als Submodul-Test
// unter pokerogue/test/porubot/regressions/ (der diesen Code nicht importieren kann).
//
// - Signatur A, `wild-w2-11610b8af6ec`: Timeout bei gesunder CommandPhase durch konkurrierende
//   Phasen-Treiber (unerledigte toEndOfTurn()/toNextTurn()-Aufrufe in advanceAfterAction).
//   Vorher 7/8 Episoden Timeout, mit installSingleDriverPhaseInterceptor 0/6.
// - Signatur B, `wild-w13-1d5b683f8692`: Gegner Pichu bekam ein Form-Objekt statt der Spezies
//   (getPokemonSpeciesForm), getName() fehlte beim Neuzeichnen des Namens, Haenger in DamageAnimPhase.
//   Vorher 6/6 Timeouts, mit speciesDataRegistry.getSpecies 6/6 regulaer.
// - Signatur C, `wild-w16-31b95ce4e94d` (Combat-Stresslauf 13.10.): Zubat setzt Mean Look ein, die Aktionsmaske
//   erlaubte trotzdem Wechsel; das Spiel lehnt den Wechsel ab und bleibt in der CommandPhase. Vorher 5-6/8 Timeouts
//   (alle mit Wechselaktion und isTrapped() === true), mit Trapping-Pruefung in der Maske 8/8 regulaer.
//
// Die Szenarien haben keinen eigenen Seed, jede Episode wuerfelt neu. Mehrere Episoden pro Szenario
// machen den Test trotzdem trennscharf: bei der vorherigen Fehlerquote waere ein gruener Lauf Zufall.
//
//   npm run rl:test:combat:collector-replays   (ca. 2-3 min)

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const scenarioDir = path.join(repoRoot, "data", "rl", "scenarios", "generated-wave-library-v3-w1-24");
const workDir = path.join(repoRoot, "data", "temp", "rl", "combat-collector-replays");

type CollectorSummary = {
  planned_episodes: number;
  regular_episodes: number;
  technical_episodes: number;
  transitions: number;
};

type ReplayOptions = { policy?: Record<string, unknown>; env?: Record<string, string> };

function runCollectorReplay(scenarioName: string, episodes: number, options: ReplayOptions = {}) {
  const scenarioPath = path.join(scenarioDir, `${scenarioName}.json`);
  assert.ok(existsSync(scenarioPath), `scenario missing: ${scenarioPath}`);
  mkdirSync(workDir, { recursive: true });
  const outputPath = path.join(workDir, `${scenarioName}.jsonl`);
  const configPath = path.join(workDir, `${scenarioName}.config.json`);
  rmSync(`${outputPath}.technical-failures.jsonl`, { force: true });
  writeFileSync(configPath, `${JSON.stringify({
    scenario_files: [scenarioPath],
    output_path: outputPath,
    append_output: false,
    episodes_per_seed: episodes,
    max_steps_per_episode: 300,
    test_timeout_ms: 600000,
    quiet_game_logs: true,
    policy: options.policy ?? { type: "random" },
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", ["scripts/01-data-generation/collector/run-pokerogue-experience-collector.ts", configPath], {
    cwd: repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `collector exited with ${result.status}:\n${(result.stderr ?? "").slice(-4000)}`);

  const summary = JSON.parse(readFileSync(`${outputPath}.summary.json`, "utf8")) as CollectorSummary;
  const failuresPath = `${outputPath}.technical-failures.jsonl`;
  const failures = existsSync(failuresPath)
    ? readFileSync(failuresPath, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const unhandledErrors = (result.stdout ?? "").match(/Unhandled (Rejection|Error)/g) ?? [];
  return { summary, failures, unhandledErrors, stdout: result.stdout ?? "" };
}

function describeFailures(failures: Array<Record<string, unknown>>): string {
  return failures.map(failure => `${failure.kind}:${failure.reason}@${failure.phase}`).join(", ");
}

test("replay wild-w2-11610b8af6ec: no zombie-driver timeout at CommandPhase (signature A)", () => {
  const { summary, failures, unhandledErrors } = runCollectorReplay("wild-w2-11610b8af6ec", 6);
  assert.deepEqual(failures, [], `technical failures: ${describeFailures(failures)}`);
  assert.equal(summary.regular_episodes, 6);
  assert.equal(summary.technical_episodes, 0);
  assert.ok(summary.transitions > 0);
  assert.deepEqual(unhandledErrors, []);
});

test("replay wild-w13-1d5b683f8692: Pichu keeps a species with getName(), no DamageAnimPhase hang (signature B)", () => {
  const { summary, failures, unhandledErrors } = runCollectorReplay("wild-w13-1d5b683f8692", 4);
  assert.deepEqual(failures, [], `technical failures: ${describeFailures(failures)}`);
  assert.equal(summary.regular_episodes, 4);
  assert.equal(summary.technical_episodes, 0);
  assert.ok(summary.transitions > 0);
  assert.deepEqual(unhandledErrors, []);
});

test("replay wild-w16-31b95ce4e94d: no switch offered while trapped by Mean Look (signature C)", () => {
  const { summary, failures, unhandledErrors } = runCollectorReplay("wild-w16-31b95ce4e94d", 8);
  assert.deepEqual(failures, [], `technical failures: ${describeFailures(failures)}`);
  assert.equal(summary.regular_episodes, 8);
  assert.equal(summary.technical_episodes, 0);
  assert.deepEqual(unhandledErrors, []);
});

test("replay wild-w6-66cfee77fee6: switch with stale party options still sends out (signature E)", () => {
  const { summary, failures, unhandledErrors, stdout } = runCollectorReplay("wild-w6-66cfee77fee6", 4, {
    policy: {
      type: "external_command",
      command: ["node", path.join(repoRoot, "scripts", "01-data-generation", "collector", "test-fixtures", "switch-first-policy-worker.ts")],
      persistent: true,
      timeout_ms: 10000,
    },
    env: { POKEROGUE_COLLECTOR_TEST_STALE_PARTY_OPTIONS: "1", POKEROGUE_COMBAT_STEP_TIMEOUT_MS: "8000" },
  });
  // Der Test-Hook muss den Fehlerzustand tatsaechlich hergestellt haben, sonst prueft der Test nichts.
  assert.equal((stdout.match(/\[collector-test-hook\] stale_party_options=true/g) ?? []).length, 4);
  assert.equal((stdout.match(/\[harness-party-select\] cleared stale party options/g) ?? []).length, 4);
  assert.deepEqual(failures, [], `technical failures: ${describeFailures(failures)}`);
  assert.equal(summary.regular_episodes, 4);
  assert.equal(summary.technical_episodes, 0);
  assert.deepEqual(unhandledErrors, []);
});
