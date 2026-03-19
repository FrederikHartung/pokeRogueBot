import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "modifier-fixed-seed-collector.test.template.ts");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", runId);
const tempTestRelativePath = path.join("test", ".external-rl", runId, "modifier-strategic-fixed-seed-collector.test.ts");
const tempTestPath = path.join(pokerogueRoot, tempTestRelativePath);

const defaultOutputPath = path.join(repoRoot, "data", "temp", "rl", "modifier-strategic-fixed-seed-collector.json");
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputPath;
const seed = process.argv[3] ?? "modifier-strategic-fixed-seed";
const runCount = Number.parseInt(process.argv[4] ?? "", 10) || 10;
const maxWaves = Number.parseInt(process.argv[5] ?? "", 10) || 10;
const modifierPolicy = process.argv[6] ?? "random_executable";
const collectorVariant = "strategic_fixed_seed";
const stepTimeoutMs = Number.parseInt(process.argv[10] ?? "", 10)
  || Number.parseInt(process.env.POKEROGUE_MODIFIER_STEP_TIMEOUT_MS ?? "", 10)
  || 15000;
const defaultCombatCheckpointCandidates = [
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-50ep.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-longer.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-v3-w1-24-conservative.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-6800-stable.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-random-valid-action-3400.pt"),
  path.join(repoRoot, "data", "rl", "models", "dqn-combat-wave-library-bootstrap-combined-960.pt"),
] as const;
const defaultPythonCandidates = [
  path.join(repoRoot, ".venv", "bin", "python"),
  path.join(repoRoot, ".venv", "bin", "python3"),
] as const;

function resolveFirstExisting(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const combatCheckpoint = process.argv[7]
  ? path.resolve(process.argv[7])
  : process.env.POKEROGUE_COMBAT_DQN_CHECKPOINT
  ? path.resolve(process.env.POKEROGUE_COMBAT_DQN_CHECKPOINT)
  : resolveFirstExisting(defaultCombatCheckpointCandidates);
const combatDevice = process.argv[8] ?? process.env.POKEROGUE_COMBAT_DQN_DEVICE ?? "cpu";
const pythonOverride = process.argv[9] ?? process.env.POKEROGUE_COMBAT_DQN_PYTHON ?? null;
const pythonBin = pythonOverride
  ? (path.isAbsolute(pythonOverride) ? pythonOverride : pythonOverride)
  : resolveFirstExisting(defaultPythonCandidates) ?? "python3";
const combatInferWorkerScript = path.join(repoRoot, "scripts", "02-training", "inference", "dqn_policy_infer_worker.py");

function cleanup(): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

if (!existsSync(templatePath)) {
  throw new Error(`Collector template not found: ${templatePath}`);
}
if (!combatCheckpoint || !existsSync(combatCheckpoint)) {
  throw new Error(
    "Combat DQN checkpoint not found. Provide it as argv[7] or env POKEROGUE_COMBAT_DQN_CHECKPOINT. "
    + `Checked defaults: ${defaultCombatCheckpointCandidates.join(", ")}`,
  );
}
if (!existsSync(combatInferWorkerScript)) {
  throw new Error(`Combat DQN worker script not found: ${combatInferWorkerScript}`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });
mkdirSync(tempDir, { recursive: true });

const templateSource = readFileSync(templatePath, "utf8");
const testSource = templateSource
  .replaceAll("__OUTPUT_PATH__", JSON.stringify(outputPath))
  .replaceAll("__SEED__", JSON.stringify(seed))
  .replaceAll("__RUN_COUNT__", String(runCount))
  .replaceAll("__MAX_WAVES__", String(maxWaves))
  .replaceAll("__COLLECTOR_VARIANT__", JSON.stringify(collectorVariant))
  .replaceAll("__MODIFIER_POLICY__", JSON.stringify(modifierPolicy))
  .replaceAll("__COMBAT_DQN_CHECKPOINT__", JSON.stringify(combatCheckpoint))
  .replaceAll("__COMBAT_DQN_DEVICE__", JSON.stringify(combatDevice))
  .replaceAll("__COMBAT_DQN_PYTHON__", JSON.stringify(pythonBin))
  .replaceAll("__COMBAT_DQN_WORKER_SCRIPT__", JSON.stringify(combatInferWorkerScript))
  .replaceAll("__STEP_TIMEOUT_MS__", String(stepTimeoutMs));

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
  console.log("Modifier strategic fixed-seed collector output:", outputPath);
  console.log("Seed:", payload.seed);
  console.log("Runs:", payload.run_count ?? "unknown");
  console.log("Max waves:", payload.max_waves ?? "unknown");
  console.log("Collector variant:", payload.collector_variant ?? "unknown");
  console.log("Step timeout ms:", payload.step_timeout_ms ?? "unknown");
  console.log("Modifier policy:", payload.modifier_policy ?? "unknown");
  console.log("Combat DQN checkpoint:", payload.combat_dqn_checkpoint ?? "unknown");
  console.log("Average wave reached:", payload.summary?.average_wave_reached ?? "unknown");
  console.log("Average total reward:", payload.summary?.average_total_reward ?? "unknown");
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}
