import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LearnPipelineConfig = {
  output_root: string;
  run_name: string;
};

type CliState = {
  configPath: string | null;
  prepareOnly: boolean;
};

type LearnManifest = {
  run_name: string;
  config_path: string;
  runtime_dir: string;
  created_at: string;
  status: "prepared" | "completed";
};

function parseCli(args: string[]): CliState {
  const cli: CliState = {
    configPath: null,
    prepareOnly: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--prepare-only") {
      cli.prepareOnly = true;
      continue;
    }

    if (!cli.configPath) {
      cli.configPath = arg;
    }
  }

  return cli;
}

// Check if config file exists and load it, if not throw an error
function loadConfig(configPath: string): LearnPipelineConfig {
  const resolvedPath = path.resolve(configPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config not found: ${resolvedPath}`);
  }

  const raw = readFileSync(resolvedPath, "utf8");

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in config: ${resolvedPath} (${String(error)})`,
    );
  }

  return validateLearnPipelineConfig(parsed, resolvedPath);
}

function validateLearnPipelineConfig(
  value: unknown,
  configPath: string,
): LearnPipelineConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Config must be a plain object: ${configPath}`);
  }

  const record = value as Record<string, unknown>;

  // Check for: Is not NULL and Is a non-empty string
  if (
    typeof record.run_name !== "string" ||
    record.run_name.trim().length === 0
  ) {
    throw new Error(`Missing or invalid run_name in config: ${configPath}`);
  }

  // Check for: Is not NULL and Is a non-empty string
  if (
    typeof record.output_root !== "string" ||
    record.output_root.trim().length === 0
  ) {
    throw new Error(`Missing or invalid output_root in config: ${configPath}`);
  }

  return {
    run_name: record.run_name,
    output_root: record.output_root,
  };
}

function buildManifest(
  configPath: string,
  runtimeDir: string,
  config: LearnPipelineConfig,
): LearnManifest {
  return {
    run_name: config.run_name,
    config_path: path.resolve(configPath),
    runtime_dir: runtimeDir,
    created_at: new Date().toISOString(),
    status: "prepared",
  };
}

// Parse the command line arguments and extract the configuration path and prepare-only flag to an object
const cli = parseCli(process.argv.slice(2));

// Check if config path is provided, if not throw an error with usage instructions
if (!cli.configPath) {
  throw new Error(
    "Usage: node run-learn-pipeline.ts <config-path> [--prepare-only]",
  );
}

// Load the configuration from the provided path
const config = loadConfig(cli.configPath);

// Create the runtime directory if it doesn't exist
const runtimeDir = path.resolve(config.output_root);
mkdirSync(runtimeDir, { recursive: true });

// Build the manifest object
const manifestPath = path.join(runtimeDir, "manifest.json");
const manifest = buildManifest(cli.configPath, runtimeDir, config);

// Write the manifest to the runtime directory
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("run-learn-pipeline started");
console.log("configPath:", path.resolve(cli.configPath));
console.log("prepareOnly:", cli.prepareOnly);
console.log("runtimeDir:", runtimeDir);
console.log("manifestPath:", manifestPath);

if (cli.prepareOnly) {
  console.log("prepare-only finished");
  process.exit(0);
}

manifest.status = "completed";
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("normal run finished");
