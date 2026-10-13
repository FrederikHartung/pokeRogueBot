// Raeumt temporaere Pipeline-Daten im Repo-Clone auf (gedacht fuer den Remote-Server nach langen Laeufen,
// funktioniert aber genauso lokal). Standard ist ein Trockenlauf; geloescht wird nur mit --apply.
//
//   node scripts/04-automation/maintenance/clean-pipeline-temp-data.ts [--apply] [--include-raw] [--runtime <name>]...
//
// Kategorien:
//   external-rl  Reste unter pokerogue/test/.external-rl/ (generierte Collector-Tests abgebrochener Laeufe)
//   test-run     Runtime-Ordner von Smoke-, Szenario-, Replay- und Repro-Laeufen
//   raw          (nur mit --include-raw) Rohdaten abgeschlossener Laeufe: collect_dataset/batches, logs, configs.
//                Manifest, Metriken, Archiv, merged/ und technical-failures/ bleiben erhalten.
//   runtime      (nur mit --runtime <name>) ein kompletter Runtime-Ordner unter data/temp/rl/pipeline-runs/,
//                z. B. ein Stresslauf, nachdem sein Archiv heruntergeladen wurde
//
// Nie angefasst: Dataset-Pools, Modelle, Szenarien, Wave-Library, data/rl/combat, Benchmark- und Training-Runs,
// Control-Ordner der Helper (*-control) sowie Runtime-Ordner, die nicht explizit genannt werden.
// Laeuft gerade eine Pipeline oder ein Collector, bricht das Skript ab.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Candidate = {
  category: "external-rl" | "test-run" | "raw" | "runtime";
  path: string;
  bytes: number;
  reason: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runtimeRoots = [
  path.join(repoRoot, "data", "rl", "pipeline-runs"),
  path.join(repoRoot, "data", "temp", "rl", "pipeline-runs"),
];
const externalRlDir = path.join(repoRoot, "pokerogue", "test", ".external-rl");
const testRunDirs = [
  path.join(repoRoot, "data", "temp", "rl", "combat-collector-replays"),
  path.join(repoRoot, "data", "temp", "rl", "repro"),
];
const testRunNamePattern = /(quick-smoke|-smoke($|-)|scenario-(timeout|error|circuit-breaker))/;
const rawSubdirs = ["collect_dataset/batches", "collect_dataset/logs", "collect_dataset/configs", "collect_dataset/failures"];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const includeRaw = args.includes("--include-raw");
const explicitRuntimes = args.flatMap((arg, index) => (arg === "--runtime" ? [args[index + 1] ?? ""] : [])).filter(Boolean);

const activeProcesses = findActivePipelineProcesses();
if (activeProcesses.length > 0) {
  console.error("Pipeline or collector processes are running; refusing to clean:");
  for (const line of activeProcesses) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

const candidates: Candidate[] = [
  ...collectExternalRl(),
  ...collectTestRuns(),
  ...(includeRaw ? collectRawData() : []),
  ...collectExplicitRuntimes(),
];

printCandidates(candidates);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to delete the entries above.");
  process.exit(0);
}

for (const candidate of candidates) {
  rmSync(candidate.path, { recursive: true, force: true });
}
console.log(`\nDeleted ${candidates.length} entries, freed ${formatBytes(sum(candidates))}.`);

function collectExternalRl(): Candidate[] {
  if (!existsSync(externalRlDir)) {
    return [];
  }
  return readdirSync(externalRlDir).map(name => {
    const entryPath = path.join(externalRlDir, name);
    return { category: "external-rl", path: entryPath, bytes: diskUsage(entryPath), reason: "leftover generated collector test" };
  });
}

function collectTestRuns(): Candidate[] {
  const result: Candidate[] = [];
  for (const dir of testRunDirs) {
    if (existsSync(dir)) {
      result.push({ category: "test-run", path: dir, bytes: diskUsage(dir), reason: "replay/repro output" });
    }
  }
  for (const root of runtimeRoots) {
    for (const name of listDirs(root)) {
      if (testRunNamePattern.test(name) && !name.endsWith("-control")) {
        const entryPath = path.join(root, name);
        result.push({ category: "test-run", path: entryPath, bytes: diskUsage(entryPath), reason: "smoke/scenario runtime" });
      }
    }
  }
  return result;
}

function collectRawData(): Candidate[] {
  const result: Candidate[] = [];
  for (const root of runtimeRoots) {
    for (const name of listDirs(root)) {
      const runtimeDir = path.join(root, name);
      if (name.endsWith("-control") || testRunNamePattern.test(name) || !isCompletedRuntime(runtimeDir)) {
        continue;
      }
      for (const subdir of rawSubdirs) {
        const entryPath = path.join(runtimeDir, subdir);
        if (existsSync(entryPath)) {
          result.push({ category: "raw", path: entryPath, bytes: diskUsage(entryPath), reason: `raw data of completed run ${name}` });
        }
      }
    }
  }
  return result;
}

function collectExplicitRuntimes(): Candidate[] {
  const tempRoot = runtimeRoots[1]!;
  return explicitRuntimes.map(name => {
    const entryPath = path.join(tempRoot, name);
    if (path.dirname(entryPath) !== tempRoot || !existsSync(entryPath)) {
      console.error(`Unknown runtime under ${tempRoot}: ${name}`);
      process.exit(1);
    }
    const archived = hasArchive(entryPath) ? "archive present" : "NO archive";
    return { category: "runtime", path: entryPath, bytes: diskUsage(entryPath), reason: `explicitly requested (${archived})` };
  });
}

function isCompletedRuntime(runtimeDir: string): boolean {
  const manifestPath = path.join(runtimeDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return false;
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { steps?: Record<string, { status?: string }> };
    const steps = Object.values(manifest.steps ?? {});
    return steps.length > 0 && steps.every(step => step.status === "completed");
  } catch {
    return false;
  }
}

function hasArchive(runtimeDir: string): boolean {
  const artifactsDir = path.join(runtimeDir, "artifacts");
  return existsSync(artifactsDir) && readdirSync(artifactsDir).some(name => name.endsWith(".tar.gz") || name.endsWith(".zip"));
}

function findActivePipelineProcesses(): string[] {
  const result = spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  return (result.stdout ?? "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => /run-[a-z-]+-pipeline\.ts|run-pokerogue-[a-z-]+collector\.ts|vitest run test\/\.external-rl/.test(line))
    .filter(line => !line.startsWith(`${process.pid} `));
}

function listDirs(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root).filter(name => statSync(path.join(root, name)).isDirectory()).sort();
}

function diskUsage(entryPath: string): number {
  const result = spawnSync("du", ["-sk", entryPath], { encoding: "utf8" });
  return Number.parseInt(result.stdout ?? "0", 10) * 1024 || 0;
}

function printCandidates(entries: Candidate[]) {
  if (entries.length === 0) {
    console.log("Nothing to clean.");
    return;
  }
  for (const entry of entries) {
    console.log(`${entry.category.padEnd(11)} ${formatBytes(entry.bytes).padStart(9)}  ${path.relative(repoRoot, entry.path)}  (${entry.reason})`);
  }
  console.log(`\nTotal: ${entries.length} entries, ${formatBytes(sum(entries))}`);
}

function sum(entries: Candidate[]): number {
  return entries.reduce((total, entry) => total + entry.bytes, 0);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${Math.ceil(bytes / 1024)} KB`;
}
