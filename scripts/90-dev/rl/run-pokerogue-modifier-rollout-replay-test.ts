import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickHeuristicV1TargetIndex } from "../../../src/main/ts/lib/modifier-heuristic-policy.ts";
import {
  buildRolloutJobs,
  buildRolloutSpec,
  observationHash,
  type ReferenceStepRecord,
  referenceStepsOf,
} from "../../../src/main/ts/lib/modifier-rollout.ts";

// Spieltest der Rollout-Policy rollout_replay_v1 (docs/modifier-rollout-plan.md, Phase 1), rund 2 min:
//   1. Referenzlauf mit heuristic_v1 (2 Wellen).
//   2. parallel: (a) Rollout, der beim letzten Schritt die Referenzwahl selbst als "Alternative" nimmt: muss Schritt fuer
//      Schritt identisch zur Referenz sein; (b) Rollout mit einer echten Alternative: Wahl an der Verzweigung ist die
//      Alternative, alle Schritte davor wurden geprueft; (c) manipulierter Hash: Abbruch mit replay_divergence.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const seed = "modifier-rollout-replay-test-s1";
const maxWaves = "2";
const tempDir = mkdtempSync(path.join(os.tmpdir(), "modifier-rollout-replay-"));

interface Episode {
  wave_reached: number;
  termination_reason: string;
  steps: ReferenceStepRecord[];
  rollout?: { branch_step: number; replay_verified_steps: number };
}

interface Output {
  episodes: Episode[];
  technical_terminations?: Array<{ reason: string }>;
}

function runCollector(name: string, policy: string, specPath?: string): Promise<Output> {
  const outputPath = path.join(tempDir, `${name}.json`);
  const env: NodeJS.ProcessEnv = { ...process.env, POKEROGUE_MODIFIER_MAX_REROLLS: "0" };
  if (specPath) {
    env.POKEROGUE_MODIFIER_ROLLOUT_SPEC = specPath;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      ["scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts", outputPath, seed, "1", maxWaves, policy],
      { cwd: repoRoot, env, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr = (stderr + String(chunk)).slice(-4000);
    });
    child.on("exit", code => {
      if (code !== 0) {
        reject(new Error(`${name}: runner exit ${code}\n${stderr}`));
        return;
      }
      resolve(JSON.parse(readFileSync(outputPath, "utf8")) as Output);
    });
  });
}

function writeSpec(name: string, spec: unknown): string {
  const specPath = path.join(tempDir, `${name}.spec.json`);
  writeFileSync(specPath, JSON.stringify(spec), "utf8");
  return specPath;
}

function chosenLabels(episode: Episode): string[] {
  return referenceStepsOf(episode.steps).map(step => step.label);
}

try {
  mkdirSync(tempDir, { recursive: true });
  const referenceOutput = await runCollector("reference", "heuristic_v1");
  assert.equal(referenceOutput.episodes.length, 1, "reference run must be regular");
  const reference = referenceOutput.episodes[0]!;
  assert.ok(reference.steps.length >= 2, `reference needs at least 2 decisions, got ${reference.steps.length}`);
  const referenceSteps = referenceStepsOf(reference.steps);
  const referenceId = `${seed}/reference`;

  const lastStep = referenceSteps.length - 1;
  const identitySpec = buildRolloutSpec(referenceId, seed, referenceSteps, {
    branch_step: lastStep,
    alternative: { candidate_index: referenceSteps[lastStep]!.candidate_index, label: referenceSteps[lastStep]!.label },
  });
  const job = buildRolloutJobs(reference.steps, pickHeuristicV1TargetIndex).find(entry => entry.branch_step >= 1);
  assert.ok(job, "reference needs an alternative after the first decision");
  const alternativeSpec = buildRolloutSpec(referenceId, seed, referenceSteps, job);
  const corruptSpec = structuredClone(alternativeSpec);
  corruptSpec.reference_steps[0]!.observation_hash = "0000000000000000";

  const [identity, alternative, corrupt] = await Promise.all([
    runCollector("identity", "rollout_replay_v1", writeSpec("identity", identitySpec)),
    runCollector("alternative", "rollout_replay_v1", writeSpec("alternative", alternativeSpec)),
    runCollector("corrupt", "rollout_replay_v1", writeSpec("corrupt", corruptSpec)),
  ]);

  assert.equal(identity.episodes.length, 1, `identity rollout must be regular: ${JSON.stringify(identity.technical_terminations)}`);
  const identityEpisode = identity.episodes[0]!;
  assert.equal(identityEpisode.wave_reached, reference.wave_reached);
  assert.deepEqual(chosenLabels(identityEpisode), chosenLabels(reference));
  assert.deepEqual(
    identityEpisode.steps.map(step => observationHash(step.modifier_transition)),
    reference.steps.map(step => observationHash(step.modifier_transition)),
  );
  assert.equal(identityEpisode.rollout?.replay_verified_steps, lastStep + 1);

  assert.equal(alternative.episodes.length, 1, `alternative rollout must be regular: ${JSON.stringify(alternative.technical_terminations)}`);
  const alternativeEpisode = alternative.episodes[0]!;
  assert.equal(alternativeEpisode.rollout?.replay_verified_steps, job.branch_step + 1);
  assert.deepEqual(chosenLabels(alternativeEpisode).slice(0, job.branch_step), chosenLabels(reference).slice(0, job.branch_step));
  assert.equal(chosenLabels(alternativeEpisode)[job.branch_step], job.alternative.label);

  assert.equal(corrupt.episodes.length, 0);
  assert.match(corrupt.technical_terminations?.[0]?.reason ?? "", /replay_divergence:state_hash:step=0/);

  console.log(
    `[modifier-rollout-replay-test] ok: reference wave ${reference.wave_reached}, ${reference.steps.length} decisions; `
    + `identity identical, alternative ${job.job_id} -> wave ${alternativeEpisode.wave_reached}, corrupt hash aborted`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
