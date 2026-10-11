// Gemeinsames Modul fuer technische Fehler in den Collector-Pipelines (Modifier und Combat).
//
// Eine technische Termination ist ein Run bzw. eine Episode, die nicht regulaer (Sieg, Niederlage,
// max_waves, max_steps) endete, sondern durch Timeout, Exception oder Prozessabbruch. Solche Runs
// landen nicht im Datensatz; die Pipeline laeuft weiter und legt pro Fehler eine Failure-Datei mit
// Repro-Informationen ab. Am Ende werden die Fehler zu Signaturen gruppiert. Ein Notausschalter
// bricht ab, wenn zu viele Fehler in Folge oder anteilig auftreten (dann ist eher die Umgebung kaputt).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type TechnicalFailurePipeline = "modifier_strategic_seeded" | "wave_library_random_collection";

export type TechnicalFailure = {
  schema_version: 1;
  pipeline: TechnicalFailurePipeline;
  failure_id: string;
  batch_id: string | null;
  // Grobe Art des Fehlers, z. B. collector_run_technical_termination, collector_run_process_timeout,
  // collector_episode_timeout, collector_episode_error, collector_process_failed.
  kind: string;
  // Konkreter Grund ohne laufende Nummern (gut gruppierbar), z. B. "step_timeout:CommandPhase".
  reason: string;
  seed: string | null;
  run_index: number | null;
  scenario: string | null;
  wave: number | null;
  phase: string | null;
  ui_mode: string | null;
  is_double_battle: boolean | null;
  repro: {
    command: string;
    params: Record<string, unknown>;
  };
  commits: GitCommits;
  recorded_at: string;
  // Rohdaten des Fehlers (Episoden-JSON, Debug-Snapshot, Fehlermeldung, Log-Auszug).
  detail: unknown;
};

export type GitCommits = {
  repo: string | null;
  submodule: string | null;
};

export type TechnicalFailureSignature = {
  signature: string;
  kind: string;
  reason: string;
  phase: string | null;
  ui_mode: string | null;
  is_double_battle: boolean | null;
  count: number;
  failure_ids: string[];
  seeds: string[];
  scenarios: string[];
  wave_min: number | null;
  wave_max: number | null;
  example_failure_id: string;
  example_repro_command: string;
};

export type CircuitBreakerConfig = {
  max_consecutive: number;
  max_ratio: number;
  min_runs_for_ratio: number;
};

// Festgelegt im Ticket (Entscheidungen): 5 in Folge oder > 20 % ab 20 abgeschlossenen Runs.
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = Object.freeze({
  max_consecutive: 5,
  max_ratio: 0.2,
  min_runs_for_ratio: 20,
});

export const CIRCUIT_BREAKER_REASON = "technical_failure_threshold_exceeded";

export function resolveCircuitBreakerConfig(raw: unknown): CircuitBreakerConfig {
  if (raw == null) {
    return { ...DEFAULT_CIRCUIT_BREAKER };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("technical_failure_threshold must be an object");
  }
  const input = raw as Record<string, unknown>;
  const allowed = new Set(["max_consecutive", "max_ratio", "min_runs_for_ratio"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown key in technical_failure_threshold: ${key}`);
    }
  }
  const resolved = { ...DEFAULT_CIRCUIT_BREAKER, ...input } as CircuitBreakerConfig;
  if (!Number.isInteger(resolved.max_consecutive) || resolved.max_consecutive <= 0) {
    throw new Error("technical_failure_threshold.max_consecutive must be a positive integer");
  }
  if (typeof resolved.max_ratio !== "number" || !(resolved.max_ratio > 0) || resolved.max_ratio > 1) {
    throw new Error("technical_failure_threshold.max_ratio must be a number in (0, 1]");
  }
  if (!Number.isInteger(resolved.min_runs_for_ratio) || resolved.min_runs_for_ratio <= 0) {
    throw new Error("technical_failure_threshold.min_runs_for_ratio must be a positive integer");
  }
  return resolved;
}

export class TechnicalFailureCircuitBreaker {
  readonly config: CircuitBreakerConfig;
  totalRuns = 0;
  technicalRuns = 0;
  consecutiveTechnicalRuns = 0;
  trippedReason: string | null = null;

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER) {
    this.config = config;
  }

  record(outcome: "regular" | "technical"): void {
    this.totalRuns += 1;
    if (outcome === "technical") {
      this.technicalRuns += 1;
      this.consecutiveTechnicalRuns += 1;
    } else {
      this.consecutiveTechnicalRuns = 0;
    }
    if (this.trippedReason == null) {
      this.trippedReason = this.evaluate();
    }
  }

  get tripped(): boolean {
    return this.trippedReason != null;
  }

  snapshot() {
    return {
      total_runs: this.totalRuns,
      technical_runs: this.technicalRuns,
      consecutive_technical_runs: this.consecutiveTechnicalRuns,
      technical_ratio: this.totalRuns > 0 ? this.technicalRuns / this.totalRuns : 0,
      config: this.config,
      tripped_reason: this.trippedReason,
    };
  }

  private evaluate(): string | null {
    if (this.consecutiveTechnicalRuns >= this.config.max_consecutive) {
      return `${CIRCUIT_BREAKER_REASON}:consecutive=${this.consecutiveTechnicalRuns}>=${this.config.max_consecutive}`;
    }
    if (this.totalRuns >= this.config.min_runs_for_ratio) {
      const ratio = this.technicalRuns / this.totalRuns;
      if (ratio > this.config.max_ratio) {
        return `${CIRCUIT_BREAKER_REASON}:ratio=${this.technicalRuns}/${this.totalRuns}>${this.config.max_ratio}`;
      }
    }
    return null;
  }
}

export function buildSignatureKey(failure: Pick<TechnicalFailure, "kind" | "reason" | "phase" | "ui_mode" | "is_double_battle">): string {
  const battle = failure.is_double_battle == null ? "unknown" : failure.is_double_battle ? "double" : "single";
  return [failure.kind, failure.reason, failure.phase ?? "unknown", failure.ui_mode ?? "unknown", battle].join("|");
}

export function groupTechnicalFailures(failures: TechnicalFailure[]): TechnicalFailureSignature[] {
  const groups = new Map<string, TechnicalFailure[]>();
  for (const failure of failures) {
    const key = buildSignatureKey(failure);
    const group = groups.get(key) ?? [];
    group.push(failure);
    groups.set(key, group);
  }

  const signatures: TechnicalFailureSignature[] = [];
  for (const [key, group] of groups) {
    const sorted = group.slice().sort((left, right) => left.failure_id.localeCompare(right.failure_id));
    const first = sorted[0]!;
    const waves = sorted.map(entry => entry.wave).filter((wave): wave is number => Number.isFinite(wave));
    signatures.push({
      signature: key,
      kind: first.kind,
      reason: first.reason,
      phase: first.phase,
      ui_mode: first.ui_mode,
      is_double_battle: first.is_double_battle,
      count: sorted.length,
      failure_ids: sorted.map(entry => entry.failure_id),
      seeds: sortedUnique(sorted.map(entry => entry.seed)),
      scenarios: sortedUnique(sorted.map(entry => entry.scenario)),
      wave_min: waves.length > 0 ? Math.min(...waves) : null,
      wave_max: waves.length > 0 ? Math.max(...waves) : null,
      example_failure_id: first.failure_id,
      example_repro_command: first.repro.command,
    });
  }

  return signatures.sort((left, right) => right.count - left.count || left.signature.localeCompare(right.signature));
}

export function writeTechnicalFailureFile(dir: string, failure: TechnicalFailure): string {
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sanitizeFileStem(failure.failure_id)}.json`);
  writeFileSync(filePath, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  return filePath;
}

export function loadTechnicalFailures(dir: string): TechnicalFailure[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => JSON.parse(readFileSync(path.join(dir, name), "utf8")) as TechnicalFailure);
}

export function writeTechnicalFailureSignatures(filePath: string, failures: TechnicalFailure[]) {
  const signatures = groupTechnicalFailures(failures);
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    technical_failure_count: failures.length,
    signature_count: signatures.length,
    signatures,
  };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

export function readGitCommits(repoRoot: string): GitCommits {
  return {
    repo: gitRevParse(repoRoot),
    submodule: gitRevParse(path.join(repoRoot, "pokerogue")),
  };
}

export function sanitizeFileStem(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
}

export function shellQuote(value: string): string {
  return /^[a-zA-Z0-9._/:=@%+-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

function gitRevParse(cwd: string): string | null {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function sortedUnique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))).sort();
}
