import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { linkModifierObservationModule } from "../../01-data-generation/collector/combat-observation-module.ts";

// Gezielte Spieltests der Ausfuehrungspfade im Strategic Collector (z. B. Attacken-Ziel-Belohnungen), die in
// Zufallslaeufen zu selten vorkommen. Die Tests stehen im Collector-Template selbst und nutzen dessen Funktionen;
// sie laufen nur mit POKEROGUE_MODIFIER_COLLECTOR_ACTION_TESTS=1, die Datensammlung wird dabei uebersprungen.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "modifier-fixed-seed-collector.test.template.ts");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempRelativeDir = path.join("test", ".external-rl", runId);
const tempDir = path.join(pokerogueRoot, tempRelativeDir);
const tempTestRelativePath = path.join(tempRelativeDir, "modifier-collector-actions.test.ts");

// Die Platzhalter der Datensammlung braucht der Aktionstest nicht; sie bekommen nur gueltige Werte.
const PLACEHOLDERS: Record<string, string> = {
  __OUTPUT_PATH__: JSON.stringify(path.join(tempDir, "unused-output.json")),
  __SEED__: JSON.stringify("collector-actions"),
  __RUN_COUNT__: "1",
  __RUN_INDEX_OFFSET__: "0",
  __MAX_WAVES__: "1",
  __COLLECTOR_VARIANT__: JSON.stringify("strategic_fixed_seed"),
  __MODIFIER_POLICY__: JSON.stringify("random_executable"),
  __COMBAT_DQN_CHECKPOINT__: JSON.stringify("unused"),
  __COMBAT_DQN_DEVICE__: JSON.stringify("cpu"),
  __COMBAT_DQN_PYTHON__: JSON.stringify("python3"),
  __COMBAT_DQN_WORKER_SCRIPT__: JSON.stringify("unused"),
  __STEP_TIMEOUT_MS__: "15000",
  __MAX_SHOP_PURCHASES__: "3",
  __MAX_REROLLS_PER_WAVE__: "2",
};

let source = readFileSync(templatePath, "utf8");
for (const [placeholder, value] of Object.entries(PLACEHOLDERS)) {
  source = source.replaceAll(placeholder, value);
}
const unresolved = source.match(/__[A-Z][A-Z0-9_]*__/g);
if (unresolved) {
  throw new Error(`Unresolved template placeholders: ${[...new Set(unresolved)].join(", ")}`);
}

mkdirSync(tempDir, { recursive: true });
writeFileSync(path.join(pokerogueRoot, tempTestRelativePath), linkModifierObservationModule(source, tempDir, repoRoot), "utf8");

const result = spawnSync(pokerogueVitestBin, ["run", tempTestRelativePath, "--no-isolate", "-t", "collector action"], {
  cwd: pokerogueRoot,
  env: {
    ...process.env,
    PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}`,
    POKEROGUE_MODIFIER_COLLECTOR_ACTION_TESTS: "1",
  },
  stdio: "inherit",
});

rmSync(tempDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
