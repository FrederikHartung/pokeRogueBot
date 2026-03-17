import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const runId = `modifier-attack-type-booster-mask-${Date.now()}-${randomUUID().slice(0, 8)}`;
const externalRlDir = path.join(pokerogueRoot, "test", ".external-rl", runId);
const templatePath = path.join(__dirname, "templates", "modifier-attack-type-booster-mask.test.template.ts");
const testPath = path.join(externalRlDir, "modifier-attack-type-booster-mask.test.ts");
const outputPath = path.join(repoRoot, "data", "temp", "rl", "modifier-attack-type-booster-mask-test.json");

mkdirSync(externalRlDir, { recursive: true });
mkdirSync(path.dirname(outputPath), { recursive: true });

const template = readFileSync(templatePath, "utf8");
const rendered = template.replace("__OUTPUT_PATH__", JSON.stringify(outputPath));
writeFileSync(testPath, rendered, "utf8");

const vitestBin = path.join(pokerogueRoot, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitestBin, "run", path.relative(pokerogueRoot, testPath), "--config", "vitest.config.ts"],
  {
    cwd: pokerogueRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
  },
);

try {
  rmSync(externalRlDir, { recursive: true, force: true });
} catch {
  // ignore cleanup issues in temp test folder
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const summary = JSON.parse(readFileSync(outputPath, "utf8"));
console.log("Validated attack type booster items:", summary.validated_items.length);
console.log("Item names:", summary.validated_items.join(", "));
