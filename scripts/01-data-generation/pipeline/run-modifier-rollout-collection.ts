import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { finished } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickHeuristicV1TargetIndex } from "../../../src/main/ts/lib/modifier-heuristic-policy.ts";
import {
  buildRolloutJobs,
  buildRolloutSpec,
  DEFAULT_MAX_ROLLOUT_ALTERNATIVES,
  MODIFIER_ROLLOUT_POLICY,
  type ReferenceStepRecord,
  referenceStepsOf,
  type RolloutJob,
} from "../../../src/main/ts/lib/modifier-rollout.ts";
import { validateModifierStrategicFixedSeedOutput } from "../../90-dev/rl/modifier-strategic-fixed-seed-contract.ts";
import {
  buildRolloutRecords,
  episodeOutcome,
  formatRolloutSummary,
  type JobResult,
  summarizeRolloutRecords,
} from "./modifier-rollout-records.ts";

// Rollout-Sammlung fuer Modifier-Entscheidungen (docs/modifier-rollout-plan.md, Phase 2).
//
// Drei Stufen, alle wiederaufnehmbar (vorhandene regulaere Ergebnisse werden uebersprungen):
//   1. Referenz: pro Seed ein heuristic_v1-Run (`<output_root>/<seed>/reference.json`).
//   2. Jobs: je Entscheidung der Referenz und Alternative ein Rollout-Auftrag (`jobs.json`, `specs/<job>.json`).
//   3. Rollouts (Policy rollout_replay_v1) parallel ueber alle Seeds, danach `rollout-records.jsonl` und
//      `rollout-summary.{json,md}`.
// Jeder Run ist ein eigener Aufruf des Strategic-Collector-Runners. Ein Seed und alle seine Rollouts muessen auf
// demselben Rechner laufen (die Hash-Pruefung im Collector bricht sonst mit replay_divergence ab).
//
// Aufruf:
//   node scripts/01-data-generation/pipeline/run-modifier-rollout-collection.ts <config.json> [--stage reference|jobs|all]
// Config: siehe docs/modifier-rollout-collection.md.

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../..");
const runnerScript = "scripts/90-dev/rl/run-pokerogue-modifier-strategic-fixed-seed-collector.ts";

interface RolloutCollectionConfig {
  seeds?: string[];
  seed_prefix?: string;
  seed_start_index?: number;
  seed_count?: number;
  output_root: string;
  max_waves: number;
  parallelism: number;
  max_alternatives?: number;
  /** Nur Entscheidungen bis zu dieser Welle verzweigen (null: alle). */
  max_branch_wave?: number | null;
  /** Fuer Tests: hoechstens so viele Jobs pro Seed (die ersten in Schrittreihenfolge). */
  max_jobs_per_seed?: number | null;
  max_shop_purchases_per_phase?: number;
  max_rerolls_per_wave?: number;
  step_timeout_ms?: number;
  run_process_timeout_ms?: number;
  combat_dqn_checkpoint?: string;
  combat_dqn_device?: string;
  combat_dqn_python?: string;
  /** Notausschalter: Abbruch, sobald so viele Rollouts mit replay_divergence endeten. */
  max_replay_divergences?: number;
  /** Notausschalter: Abbruch, wenn nach mindestens 20 Runs dieser Anteil technisch scheiterte. */
  max_technical_failure_share?: number;
}

type Stage = "reference" | "jobs" | "all";

function parseCli(argv: string[]): { configPath: string; stage: Stage } {
  const [configPath, ...rest] = argv;
  if (!configPath) {
    throw new Error("Usage: run-modifier-rollout-collection.ts <config.json> [--stage reference|jobs|all]");
  }
  let stage: Stage = "all";
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--stage" && ["reference", "jobs", "all"].includes(rest[index + 1] ?? "")) {
      stage = rest[index + 1] as Stage;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${rest[index]}`);
    }
  }
  return { configPath: path.resolve(configPath), stage };
}

function loadConfig(configPath: string): RolloutCollectionConfig {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as RolloutCollectionConfig;
  if (typeof config.output_root !== "string" || config.output_root.length === 0) {
    throw new Error("config.output_root is required");
  }
  if (!Number.isInteger(config.max_waves) || config.max_waves < 1) {
    throw new Error("config.max_waves must be a positive integer");
  }
  if (!Number.isInteger(config.parallelism) || config.parallelism < 1) {
    throw new Error("config.parallelism must be a positive integer");
  }
  return config;
}

function seedsOf(config: RolloutCollectionConfig): string[] {
  if (config.seeds && config.seeds.length > 0) {
    return config.seeds;
  }
  if (!config.seed_prefix || !Number.isInteger(config.seed_count)) {
    throw new Error("config needs seeds[] or seed_prefix + seed_count");
  }
  const start = config.seed_start_index ?? 1;
  return Array.from({ length: config.seed_count! }, (_, index) => `${config.seed_prefix}${start + index}`);
}

// --- Runner-Aufrufe ---------------------------------------------------------------------------------------------

interface RunRequest {
  label: string;
  outputPath: string;
  logPath: string;
  seed: string;
  runIndex: number;
  policy: "heuristic_v1" | typeof MODIFIER_ROLLOUT_POLICY;
  specPath?: string;
}

type RunResult =
  | { status: "regular"; episode: Record<string, unknown> }
  | { status: "failed"; reason: string };

const activeChildren = new Set<ChildProcess>();
let stopping = false;

function stopChildren(signal: NodeJS.Signals): void {
  stopping = true;
  for (const child of activeChildren) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Prozessgruppe schon beendet
      }
    }
  }
  console.error(`[modifier-rollout] ${signal}: laufende Runs beendet`);
  process.exit(130);
}
process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

function readRunResult(outputPath: string): RunResult | null {
  if (!existsSync(outputPath)) {
    return null;
  }
  try {
    const payload = validateModifierStrategicFixedSeedOutput(JSON.parse(readFileSync(outputPath, "utf8")));
    const episodes = payload.episodes as Array<Record<string, unknown>>;
    if (episodes.length === 1) {
      return { status: "regular", episode: episodes[0]! };
    }
    const terminations = (payload.technical_terminations ?? []) as Array<{ kind: string; reason: string }>;
    const first = terminations[0];
    return { status: "failed", reason: first ? `${first.kind}:${first.reason}` : `episode_count:${episodes.length}` };
  } catch (error) {
    return { status: "failed", reason: `invalid_output:${error instanceof Error ? error.message : String(error)}` };
  }
}

function runnerEnv(config: RolloutCollectionConfig, specPath?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (config.max_shop_purchases_per_phase !== undefined) {
    env.POKEROGUE_MODIFIER_MAX_SHOP_PURCHASES = String(config.max_shop_purchases_per_phase);
  }
  env.POKEROGUE_MODIFIER_MAX_REROLLS = String(config.max_rerolls_per_wave ?? 0);
  delete env.POKEROGUE_MODIFIER_MODEL_CHECKPOINT;
  if (specPath) {
    env.POKEROGUE_MODIFIER_ROLLOUT_SPEC = specPath;
  } else {
    delete env.POKEROGUE_MODIFIER_ROLLOUT_SPEC;
  }
  return env;
}

async function executeRun(config: RolloutCollectionConfig, request: RunRequest): Promise<RunResult> {
  mkdirSync(path.dirname(request.outputPath), { recursive: true });
  mkdirSync(path.dirname(request.logPath), { recursive: true });
  const args = [
    runnerScript,
    request.outputPath,
    request.seed,
    "1",
    String(config.max_waves),
    request.policy,
    config.combat_dqn_checkpoint ? path.resolve(repoRoot, config.combat_dqn_checkpoint) : "",
    config.combat_dqn_device ?? "cpu",
    config.combat_dqn_python ?? "",
    String(config.step_timeout_ms ?? 15000),
    String(config.run_process_timeout_ms ?? 2400000),
    String(request.runIndex),
  ];
  const log = createWriteStream(request.logPath, { flags: "w" });
  const child = spawn("node", args, {
    cwd: repoRoot,
    env: runnerEnv(config, request.specPath),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  activeChildren.add(child);
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  const exitCode = await new Promise<number | null>(resolve => {
    child.on("error", () => resolve(null));
    child.on("exit", code => resolve(code));
  });
  activeChildren.delete(child);
  log.end();
  await finished(log).catch(() => undefined);

  const result = readRunResult(request.outputPath)
    ?? { status: "failed" as const, reason: `runner_exit_${exitCode ?? "none"}_without_output` };
  if (result.status === "regular") {
    // Logs regulaerer Runs sind gross und ohne Wert; Fehler-Logs bleiben fuer die Analyse.
    rmSync(request.logPath, { force: true });
  }
  return result;
}

async function runPool<T>(items: readonly T[], parallelism: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(parallelism, items.length) }, async () => {
    while (!stopping && next < items.length) {
      const item = items[next]!;
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

class CircuitBreaker {
  private runs = 0;
  private failures = 0;
  private divergences = 0;
  private readonly config: RolloutCollectionConfig;

  constructor(config: RolloutCollectionConfig) {
    this.config = config;
  }

  record(result: RunResult): void {
    this.runs += 1;
    if (result.status === "failed") {
      this.failures += 1;
      if (result.reason.includes("replay_divergence")) {
        this.divergences += 1;
      }
    }
    const maxDivergences = this.config.max_replay_divergences ?? 3;
    if (this.divergences > maxDivergences) {
      throw new Error(`circuit_breaker:replay_divergence:${this.divergences}>${maxDivergences}`);
    }
    const maxShare = this.config.max_technical_failure_share ?? 0.1;
    if (this.runs >= 20 && this.failures / this.runs > maxShare) {
      throw new Error(`circuit_breaker:technical_failures:${this.failures}/${this.runs}`);
    }
  }
}

// --- Stufen -----------------------------------------------------------------------------------------------------

interface SeedPaths {
  dir: string;
  reference: string;
  jobs: string;
}

function seedPaths(outputRoot: string, seed: string): SeedPaths {
  const dir = path.join(outputRoot, seed);
  return { dir, reference: path.join(dir, "reference.json"), jobs: path.join(dir, "jobs.json") };
}

interface JobsFile {
  seed: string;
  reference_id: string;
  reference_wave_reached: number;
  jobs: RolloutJob[];
}

function writeJobs(config: RolloutCollectionConfig, outputRoot: string, seed: string, episode: Record<string, unknown>): JobsFile {
  const paths = seedPaths(outputRoot, seed);
  const steps = episode.steps as ReferenceStepRecord[];
  const referenceId = `${seed}/reference`;
  const referenceSteps = referenceStepsOf(steps);
  let jobs = buildRolloutJobs(steps, pickHeuristicV1TargetIndex, config.max_alternatives ?? DEFAULT_MAX_ROLLOUT_ALTERNATIVES);
  if (config.max_branch_wave != null) {
    jobs = jobs.filter(job => job.wave_index <= config.max_branch_wave!);
  }
  if (config.max_jobs_per_seed != null) {
    jobs = jobs.slice(0, config.max_jobs_per_seed);
  }
  mkdirSync(path.join(paths.dir, "specs"), { recursive: true });
  for (const job of jobs) {
    writeFileSync(
      path.join(paths.dir, "specs", `${job.job_id}.json`),
      `${JSON.stringify(buildRolloutSpec(referenceId, seed, referenceSteps, job))}\n`,
      "utf8",
    );
  }
  const jobsFile: JobsFile = { seed, reference_id: referenceId, reference_wave_reached: episode.wave_reached as number, jobs };
  writeFileSync(paths.jobs, `${JSON.stringify(jobsFile, null, 2)}\n`, "utf8");
  return jobsFile;
}

async function main(): Promise<void> {
  const { configPath, stage } = parseCli(process.argv.slice(2));
  const config = loadConfig(configPath);
  const outputRoot = path.resolve(repoRoot, config.output_root);
  const seeds = seedsOf(config);
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(path.join(outputRoot, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const breaker = new CircuitBreaker(config);
  const startedAt = Date.now();
  const failures: Array<{ label: string; reason: string; log: string }> = [];

  // 1. Referenzlaeufe
  const references = new Map<string, Record<string, unknown>>();
  const pendingReferences = seeds.filter(seed => {
    const existing = readRunResult(seedPaths(outputRoot, seed).reference);
    if (existing?.status === "regular") {
      references.set(seed, existing.episode);
      return false;
    }
    return true;
  });
  console.log(`[modifier-rollout] Referenz: ${references.size} vorhanden, ${pendingReferences.length} zu laufen`);
  await runPool(pendingReferences, config.parallelism, async seed => {
    const paths = seedPaths(outputRoot, seed);
    const logPath = path.join(paths.dir, "logs", "reference.log");
    const result = await executeRun(config, {
      label: `${seed}/reference`,
      outputPath: paths.reference,
      logPath,
      seed,
      runIndex: 0,
      policy: "heuristic_v1",
    });
    breaker.record(result);
    if (result.status === "regular") {
      references.set(seed, result.episode);
      console.log(`[modifier-rollout] ${seed} Referenz: Welle ${String(result.episode.wave_reached)}`);
    } else {
      failures.push({ label: `${seed}/reference`, reason: result.reason, log: logPath });
      console.error(`[modifier-rollout] ${seed} Referenz fehlgeschlagen: ${result.reason}`);
    }
  });
  if (stage === "reference") {
    return;
  }

  // 2. Jobs
  const jobsBySeed = new Map<string, JobsFile>();
  for (const seed of seeds) {
    const episode = references.get(seed);
    if (episode) {
      jobsBySeed.set(seed, writeJobs(config, outputRoot, seed, episode));
    }
  }
  const allJobs = [...jobsBySeed.values()].flatMap(file => file.jobs.map(job => ({ seed: file.seed, job })));
  console.log(`[modifier-rollout] Jobs: ${allJobs.length} fuer ${jobsBySeed.size} Seeds`);
  if (stage === "jobs") {
    return;
  }

  // 3. Rollouts
  const results = new Map<string, JobResult[]>();
  const pending: Array<{ seed: string; job: RolloutJob; jobNumber: number }> = [];
  allJobs.forEach(({ seed, job }, index) => {
    const outputPath = path.join(seedPaths(outputRoot, seed).dir, "rollouts", `${job.job_id}.json`);
    const existing = readRunResult(outputPath);
    if (existing?.status === "regular") {
      results.set(seed, [...(results.get(seed) ?? []), { job, status: "regular", outcome: episodeOutcome(existing.episode as never) }]);
    } else {
      pending.push({ seed, job, jobNumber: index + 1 });
    }
  });
  console.log(`[modifier-rollout] Rollouts: ${allJobs.length - pending.length} vorhanden, ${pending.length} zu laufen`);
  let done = 0;
  await runPool(pending, config.parallelism, async ({ seed, job, jobNumber }) => {
    const paths = seedPaths(outputRoot, seed);
    const request: RunRequest = {
      label: `${seed}/${job.job_id}`,
      outputPath: path.join(paths.dir, "rollouts", `${job.job_id}.json`),
      logPath: path.join(paths.dir, "logs", `${job.job_id}.log`),
      seed,
      runIndex: jobNumber,
      policy: MODIFIER_ROLLOUT_POLICY,
      specPath: path.join(paths.dir, "specs", `${job.job_id}.json`),
    };
    let result = await executeRun(config, request);
    if (result.status === "failed" && !result.reason.includes("replay_divergence") && !stopping) {
      // Zeitueberschreitungen unter Last sind meist voruebergehend: einmal wiederholen. Abweichungen nicht.
      console.error(`[modifier-rollout] ${request.label} Wiederholung nach ${result.reason}`);
      result = await executeRun(config, request);
    }
    breaker.record(result);
    done += 1;
    const entry: JobResult = result.status === "regular"
      ? { job, status: "regular", outcome: episodeOutcome(result.episode as never) }
      : { job, status: "failed", reason: result.reason };
    results.set(seed, [...(results.get(seed) ?? []), entry]);
    if (result.status === "failed") {
      failures.push({ label: request.label, reason: result.reason, log: request.logPath });
    }
    const minutes = (Date.now() - startedAt) / 60000;
    console.log(
      `[modifier-rollout] ${done}/${pending.length} ${request.label}: `
      + (result.status === "regular"
        ? `Welle ${String(result.episode.wave_reached)} (Referenz ${jobsBySeed.get(seed)!.reference_wave_reached})`
        : `FEHLER ${result.reason}`)
      + ` [${minutes.toFixed(1)} min]`,
    );
  });

  // 4. Datensatz und Auswertung
  const records = seeds.flatMap(seed => {
    const episode = references.get(seed);
    const jobsFile = jobsBySeed.get(seed);
    return episode && jobsFile
      ? buildRolloutRecords(seed, jobsFile.reference_id, episode as never, results.get(seed) ?? [])
      : [];
  });
  writeFileSync(path.join(outputRoot, "rollout-records.jsonl"), records.map(record => JSON.stringify(record)).join("\n") + "\n", "utf8");
  const summary = summarizeRolloutRecords(records);
  writeFileSync(
    path.join(outputRoot, "rollout-summary.json"),
    `${JSON.stringify({ ...summary, failures, runtime_minutes: (Date.now() - startedAt) / 60000 }, null, 2)}\n`,
    "utf8",
  );
  const markdown = formatRolloutSummary(summary);
  writeFileSync(path.join(outputRoot, "rollout-summary.md"), `${markdown}\n`, "utf8");
  console.log(markdown);
  console.log(`[modifier-rollout] fertig: ${records.length} Records, ${failures.length} Fehler, ${outputRoot}`);
}

main().catch(error => {
  console.error(`[modifier-rollout] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  for (const child of activeChildren) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // schon beendet
      }
    }
  }
  process.exit(1);
});
