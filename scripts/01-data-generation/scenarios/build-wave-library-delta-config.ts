import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRandomCollectionPipelineConfig } from "../rl-config/run-config-contract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const args = parseArgs(process.argv.slice(2));

if (!args.scenarioDir || !args.baselineIndex) {
  throw new Error(
    "Usage: node scripts/01-data-generation/scenarios/build-wave-library-delta-config.ts"
      + " --scenario-dir <dir>"
      + " --baseline-index <index.json>"
      + " [--template-config <config.json> --output-config <config.json> --run-suffix <suffix>]"
      + " [--write-baseline-only]",
  );
}

const scenarioDir = path.resolve(args.scenarioDir);
if (!existsSync(scenarioDir)) {
  throw new Error(`Scenario dir not found: ${scenarioDir}`);
}

const baselineIndexPath = path.resolve(args.baselineIndex);
const currentScenarioFiles = readdirSync(scenarioDir)
  .filter(name => name.endsWith(".json"))
  .sort();
const baselineEntries = loadBaselineEntries(baselineIndexPath);
const baselineSet = new Set(baselineEntries);
const newEntries = currentScenarioFiles.filter(name => !baselineSet.has(name));

const summary = {
  scenario_dir: scenarioDir,
  baseline_index: baselineIndexPath,
  current_scenarios: currentScenarioFiles.length,
  baseline_scenarios: baselineEntries.length,
  new_scenarios: newEntries.length,
  new_files: newEntries,
  no_new_scenarios: newEntries.length === 0,
  generated_at: new Date().toISOString(),
};

if (args.writeBaselineOnly) {
  writeBaselineIndex(baselineIndexPath, currentScenarioFiles);
  console.log(`Baseline index updated: ${baselineIndexPath}`);
  console.log(`Scenario count: ${currentScenarioFiles.length}`);
  process.exit(0);
}

if (!args.templateConfig || !args.outputConfig) {
  writeJsonToStdout(summary);
  process.exit(0);
}

const templateConfigPath = path.resolve(args.templateConfig);
if (!existsSync(templateConfigPath)) {
  throw new Error(`Template config not found: ${templateConfigPath}`);
}

const outputConfigPath = path.resolve(args.outputConfig);
if (newEntries.length === 0) {
  mkdirSync(path.dirname(outputConfigPath), { recursive: true });
  if (existsSync(outputConfigPath)) {
    rmSync(outputConfigPath, { force: true });
  }
  writeFileSync(
    `${outputConfigPath}.summary.json`,
    `${JSON.stringify({
      ...summary,
      template_config: templateConfigPath,
      output_config: outputConfigPath,
      run_suffix: args.runSuffix ?? null,
    }, null, 2)}\n`,
    "utf8",
  );
  console.log("No new scenarios detected. No delta config written.");
  console.log(`Summary written: ${outputConfigPath}.summary.json`);
  process.exit(0);
}

const templateConfig = validateRandomCollectionPipelineConfig(JSON.parse(readFileSync(templateConfigPath, "utf8")), {
  context: templateConfigPath,
});
const outputConfigDir = path.dirname(outputConfigPath);
const outputBaseName = path.basename(outputConfigPath, path.extname(outputConfigPath));
const runSuffix = args.runSuffix ?? outputBaseName;

const scenarioFileEntries = newEntries.map(name => {
  const fullPath = path.join(scenarioDir, name);
  return toRepoRelativePath(fullPath, outputConfigDir);
});

const deltaConfig = structuredClone(templateConfig);
delete deltaConfig.scenario_dirs;
deltaConfig.scenario_files = scenarioFileEntries;
deltaConfig.output_root = `./pipeline-runs/${outputBaseName}`;
deltaConfig.manifest_path = `./pipeline-runs/${outputBaseName}/manifest.json`;
if (deltaConfig.dataset_pool) {
  deltaConfig.dataset_pool.run_name = runSuffix;
}

mkdirSync(outputConfigDir, { recursive: true });
writeFileSync(outputConfigPath, `${JSON.stringify(deltaConfig, null, 2)}\n`, "utf8");
writeFileSync(
  `${outputConfigPath}.summary.json`,
  `${JSON.stringify({
    ...summary,
    template_config: templateConfigPath,
    output_config: outputConfigPath,
    run_suffix: runSuffix,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Delta config written: ${outputConfigPath}`);
console.log(`New scenarios: ${newEntries.length}`);
console.log(`Summary written: ${outputConfigPath}.summary.json`);

function parseArgs(argv: string[]) {
  const parsed: Record<string, string | boolean | null> = {
    scenarioDir: null,
    baselineIndex: null,
    templateConfig: null,
    outputConfig: null,
    runSuffix: null,
    writeBaselineOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--scenario-dir") {
      parsed.scenarioDir = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--baseline-index") {
      parsed.baselineIndex = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--template-config") {
      parsed.templateConfig = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--output-config") {
      parsed.outputConfig = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--run-suffix") {
      parsed.runSuffix = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--write-baseline-only") {
      parsed.writeBaselineOnly = true;
    }
  }

  return parsed as {
    scenarioDir: string | null;
    baselineIndex: string | null;
    templateConfig: string | null;
    outputConfig: string | null;
    runSuffix: string | null;
    writeBaselineOnly: boolean;
  };
}

function loadBaselineEntries(filePath: string) {
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  if (Array.isArray(raw?.scenario_files)) {
    return raw.scenario_files
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .sort();
  }
  return [];
}

function writeBaselineIndex(filePath: string, scenarioFiles: string[]) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({
      scenario_dir: path.relative(repoRoot, scenarioDir).replaceAll(path.sep, "/"),
      scenario_files: scenarioFiles,
      captured_at: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
}

function toRepoRelativePath(filePath: string, relativeToDir: string) {
  const relativePath = path.relative(relativeToDir, filePath).replaceAll(path.sep, "/");
  if (relativePath.startsWith(".")) {
    return relativePath;
  }
  return `./${relativePath}`;
}

function writeJsonToStdout(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
