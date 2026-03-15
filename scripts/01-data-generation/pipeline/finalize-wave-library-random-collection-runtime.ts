import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateRandomCollectionPipelineConfig } from "../rl-config/run-config-contract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const configArg = process.argv[2] ?? null;
if (!configArg) {
  throw new Error("Usage: node scripts/01-data-generation/pipeline/finalize-wave-library-random-collection-runtime.ts <config_path>");
}

const configPath = path.resolve(configArg);
if (!existsSync(configPath)) {
  throw new Error(`Collection config not found: ${configPath}`);
}

const config = validateRandomCollectionPipelineConfig(JSON.parse(readFileSync(configPath, "utf8")), {
  context: configPath,
});
const configDir = path.dirname(configPath);
const dataRlDir = path.join(repoRoot, "data", "rl");
const runtimeDir = resolvePathWithFallbacks(
  config.output_root ?? "./pipeline-runs/wave-library-random-collection",
  [configDir, dataRlDir, repoRoot],
);
const retention = config.runtime_retention ?? {};

if (!retention.archive_debug_on_success && !retention.cleanup_runtime_on_success) {
  process.exit(0);
}

const metricsPath = path.join(runtimeDir, "collection-metrics.json");
if (!existsSync(metricsPath)) {
  process.exit(0);
}

const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
const datasetPoolRunDir = metrics.dataset_pool_run_dir;
if (typeof datasetPoolRunDir !== "string" || datasetPoolRunDir.length === 0) {
  process.exit(0);
}

const runtimeDebugDir = path.join(datasetPoolRunDir, "runtime-debug");
const runtimeDebugArchivePath = path.join(runtimeDebugDir, "runtime-debug.tar.gz");
mkdirSync(runtimeDebugDir, { recursive: true });

const archiveEntries = [
  "manifest.json",
  "collection-metrics.json",
  "artifacts-summary.json",
  "remote-random-collection.log",
  "remote-random-collection-errors.log",
  "remote-random-collection-warnings.log",
  "issues-summary.txt",
];

if (retention.include_batch_configs_in_debug_archive) {
  archiveEntries.push(path.join("collect_dataset", "configs"));
}
if (retention.include_batch_outputs_in_debug_archive) {
  archiveEntries.push(path.join("collect_dataset", "batches"));
}

const existingEntries = archiveEntries.filter(entry => existsSync(path.join(runtimeDir, entry)));
if (retention.archive_debug_on_success && existingEntries.length > 0) {
  const tarResult = spawnSync("tar", ["-czf", runtimeDebugArchivePath, "-C", runtimeDir, ...existingEntries], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (tarResult.status !== 0) {
    throw new Error((tarResult.stderr || tarResult.stdout || "Failed to create runtime-debug archive").trim());
  }

  writeFileSync(
    path.join(runtimeDebugDir, "runtime-debug-metadata.json"),
    `${JSON.stringify({
      source_runtime_dir: runtimeDir,
      archived_at: new Date().toISOString(),
      archived_entries: existingEntries,
      cleanup_runtime_on_success: Boolean(retention.cleanup_runtime_on_success),
    }, null, 2)}\n`,
    "utf8",
  );
}

if (retention.cleanup_runtime_on_success && existsSync(runtimeDir)) {
  rmSync(runtimeDir, { recursive: true, force: true });
}

function resolvePathWithFallbacks(pathValue, bases) {
  if (path.isAbsolute(pathValue)) {
    return pathValue;
  }
  for (const base of bases) {
    const candidate = path.resolve(base, pathValue);
    if (existsSync(candidate) || existsSync(path.dirname(candidate))) {
      return candidate;
    }
  }
  return path.resolve(bases[0], pathValue);
}
