import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type LearnPipelineConfig = {
  output_root?: string;
  run_name?: string;
};

type CliState = {
  configPath: string | null;
  prepareOnly: boolean;
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

function loadConfig(configPath: string): LearnPipelineConfig {
  const resolvedPath = path.resolve(configPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config not found: ${resolvedPath}`);
  }

  const raw = readFileSync(resolvedPath, "utf8");

  try {
    return JSON.parse(raw) as LearnPipelineConfig;
  } catch (error) {
    throw new Error(
      `Invalid JSON in config: ${resolvedPath} (${String(error)})`,
    );
  }
}

//parse the command line arguments and extract the configuration path and prepare-only flag to an object
const cli = parseCli(process.argv.slice(2));

console.log("run-learn-pipeline started");
console.log(
  "configPath:",
  cli.configPath ? path.resolve(cli.configPath) : "<none>",
);
console.log("prepareOnly:", cli.prepareOnly);

if (cli.prepareOnly) {
  console.log("prepare-only finished");
  process.exit(0);
}

console.log("normal run finished");
