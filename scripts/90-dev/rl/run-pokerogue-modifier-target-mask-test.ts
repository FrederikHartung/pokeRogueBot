import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "modifier-target-mask.test.template.ts");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", runId);
const tempTestRelativePath = path.join("test", ".external-rl", runId, "modifier-target-mask.test.ts");
const tempTestPath = path.join(pokerogueRoot, tempTestRelativePath);

const defaultOutputPath = path.join(repoRoot, "data", "temp", "rl", "modifier-target-mask-test.json");
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputPath;

function cleanup(): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

if (!existsSync(templatePath)) {
  throw new Error(`Target-mask template not found: ${templatePath}`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(tempDir, { recursive: true });

const templateSource = readFileSync(templatePath, "utf8");
const testSource = templateSource.replaceAll("__OUTPUT_PATH__", JSON.stringify(outputPath));

writeFileSync(tempTestPath, testSource, { encoding: "utf8" });

const runnerEnv = {
  ...process.env,
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}`,
};

const result = spawnSync(
  pokerogueVitestBin,
  ["run", tempTestRelativePath, "--no-isolate"],
  {
    cwd: pokerogueRoot,
    env: runnerEnv,
    stdio: "inherit",
  },
);

cleanup();

if (result.status !== 0 && !existsSync(outputPath)) {
  process.exit(result.status ?? 1);
}

if (existsSync(outputPath)) {
  const payload = JSON.parse(readFileSync(outputPath, "utf8"));
  console.log("Modifier target-mask test output:", outputPath);
  console.log("Reward modifier:", payload.reward_modifier_id ?? "unknown");
  console.log("Target availability:", payload.targets ?? []);
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}
