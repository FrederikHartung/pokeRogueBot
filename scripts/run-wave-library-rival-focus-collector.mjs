import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runProfileCollector } from "./run-wave-library-collector-profile.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataRlDir = path.join(repoRoot, "data", "rl");

const cliArgs = process.argv.slice(2);
const prepareOnly = cliArgs.includes("--prepare-only");
const skipMaterialize = cliArgs.includes("--skip-materialize");

const adapterConfigPath = path.join(dataRlDir, "wave-library-scenario-adapter-run-w1-8.json");
const profileEntries = [
  {
    profilePath: path.join(dataRlDir, "wave-library-profile-train-rival-focus-w1-7-base.json"),
    sourceLabel: "w1_7_base",
    outputPath: path.join(dataRlDir, "combat", "train-wave-library-rival-focus-w1-7-base.jsonl"),
  },
  {
    profilePath: path.join(dataRlDir, "wave-library-profile-train-rival-focus-w5-topup.json"),
    sourceLabel: "w5_topup",
    outputPath: path.join(dataRlDir, "combat", "train-wave-library-rival-focus-w5-topup.jsonl"),
  },
  {
    profilePath: path.join(dataRlDir, "wave-library-profile-train-rival-focus-w7-topup.json"),
    sourceLabel: "w7_topup",
    outputPath: path.join(dataRlDir, "combat", "train-wave-library-rival-focus-w7-topup.jsonl"),
  },
  {
    profilePath: path.join(dataRlDir, "wave-library-profile-train-rival-focus-w1-7-supplement.json"),
    sourceLabel: "w1_7_supplement",
    outputPath: path.join(dataRlDir, "combat", "train-wave-library-rival-focus-w1-7-supplement.jsonl"),
  },
  {
    profilePath: path.join(dataRlDir, "wave-library-profile-train-rival-focus-w8-deep.json"),
    sourceLabel: "w8_deep",
    outputPath: path.join(dataRlDir, "combat", "train-wave-library-rival-focus-w8-deep.jsonl"),
  },
];

const mergedDatasetPath = path.join(dataRlDir, "combat", "train-wave-library-rival-focus-504.jsonl");

if (!skipMaterialize) {
  runCommand("node", ["scripts/run-wave-library-scenario-adapter.mjs", adapterConfigPath]);
}

for (const entry of profileEntries) {
  const result = runProfileCollector(entry.profilePath, { prepareOnly });
  if (result.statusCode !== 0) {
    process.exit(result.statusCode);
  }
}

if (prepareOnly) {
  console.log("Prepared rival-focus collector run configs.");
  console.log(`Merged dataset target: ${mergedDatasetPath}`);
  process.exit(0);
}

mkdirSync(path.dirname(mergedDatasetPath), { recursive: true });

for (const entry of profileEntries) {
  if (!existsSync(entry.outputPath)) {
    throw new Error(`Missing collector output for merge: ${entry.outputPath}`);
  }
}

const mergeArgs = [
  "scripts/merge-rl-jsonl-datasets.mjs",
  "--output",
  mergedDatasetPath,
];

for (const entry of profileEntries) {
  mergeArgs.push("--input", `${entry.outputPath}:${entry.sourceLabel}`);
}

runCommand("node", mergeArgs);
runCommand("node", ["scripts/run-rl-dataset-sanity.mjs", mergedDatasetPath]);
runCommand(
  "node",
  [
    "scripts/report-rl-dataset.mjs",
    "--input",
    mergedDatasetPath,
    "--output",
    path.join(dataRlDir, "combat", "train-wave-library-rival-focus-504-report.json"),
  ],
);

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}
