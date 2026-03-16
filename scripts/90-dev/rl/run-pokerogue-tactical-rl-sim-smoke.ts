import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "tactical-rl-sim-smoke.test.template.ts");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", runId);
const tempTestRelativePath = path.join("test", ".external-rl", runId, "tactical-rl-sim-smoke.test.ts");
const tempTestPath = path.join(pokerogueRoot, tempTestRelativePath);

const defaultOutputPath = path.join(repoRoot, "data", "temp", "rl", "tactical-rl-sim-smoke.json");
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputPath;
const seed = process.argv[3] ?? "tactical-rl-sim-smoke";
const maxWaves = Number.parseInt(process.argv[4] ?? "", 10) || 3;
const modifierStrategy = process.argv[5] ?? "skip";

function cleanup(): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

if (!existsSync(templatePath)) {
  throw new Error(`Smoke template not found: ${templatePath}`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(tempDir, { recursive: true });

const templateSource = readFileSync(templatePath, "utf8");
const testSource = templateSource
  .replaceAll("__OUTPUT_PATH__", JSON.stringify(outputPath))
  .replaceAll("__SEED__", JSON.stringify(seed))
  .replaceAll("__MAX_WAVES__", String(maxWaves))
  .replaceAll("__MODIFIER_STRATEGY__", JSON.stringify(modifierStrategy));

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
  console.log("Tactical RL smoke summary written to:", outputPath);
  console.log("Seed:", payload.seed);
  console.log("Max waves:", payload.max_waves ?? "unknown");
  console.log("Modifier strategy:", payload.modifier_strategy ?? "unknown");
  console.log("Decision types:", Array.isArray(payload.decision_types) ? payload.decision_types.join(", ") : "unknown");
  console.log("Decision count:", payload.decision_count ?? "unknown");
  console.log("Termination reason:", payload.termination_reason ?? "unknown");
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}
