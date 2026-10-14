import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { linkModifierObservationModule } from "../../01-data-generation/collector/combat-observation-module.ts";

// Spieltest fuer den modifier-v1-Builder (src/main/ts/lib/modifier-observation.ts): baut State und Kandidaten in einer
// echten SelectModifierPhase und validiert das Ergebnis gegen docs/rl-schema/modifier-transition-v1.schema.json.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const templatePath = path.join(__dirname, "templates", "modifier-observation-v1.test.template.ts");
const schemaPath = path.join(repoRoot, "docs", "rl-schema", "modifier-transition-v1.schema.json");
const examplePath = path.join(repoRoot, "docs", "rl-schema", "modifier-transition-v1.example.json");

const runId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", runId);
const tempTestRelativePath = path.join("test", ".external-rl", runId, "modifier-observation-v1.test.ts");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "data", "temp", "rl", "modifier-observation-v1-test.json");

type ValidateFn = ((data: unknown) => boolean) & { errors?: unknown };

function loadSchemaValidator(): ValidateFn {
  // ajv kommt ueber die Submodul-Abhaengigkeiten mit; das Hauptrepo hat keine eigene Kopie.
  const requireFromPokerogue = createRequire(path.join(pokerogueRoot, "package.json"));
  const Ajv2020 = requireFromPokerogue("ajv/dist/2020").default;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
}

function runGameTest(): number {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  mkdirSync(tempDir, { recursive: true });
  try {
    const templateSource = readFileSync(templatePath, "utf8").replaceAll("__OUTPUT_PATH__", JSON.stringify(outputPath));
    const testSource = linkModifierObservationModule(templateSource, tempDir, repoRoot);
    writeFileSync(path.join(pokerogueRoot, tempTestRelativePath), testSource, "utf8");
    const result = spawnSync(pokerogueVitestBin, ["run", tempTestRelativePath, "--no-isolate"], {
      cwd: pokerogueRoot,
      env: { ...process.env, PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}` },
      stdio: "inherit",
    });
    return result.status ?? 1;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const status = runGameTest();
if (status !== 0) {
  console.error(`Modifier observation game test failed (vitest exit ${status}).`);
  process.exit(status);
}
if (!existsSync(outputPath)) {
  console.error(`Game test passed but wrote no output: ${outputPath}`);
  process.exit(1);
}

const validate = loadSchemaValidator();
const { observations } = JSON.parse(readFileSync(outputPath, "utf8")) as { observations: object[] };
const records = [
  ...observations.map((observation, index) => ({
    label: `game observation ${index}`,
    record: { ...observation, selected_candidate_index: 0, immediate_reward: 0 },
  })),
  { label: "example", record: JSON.parse(readFileSync(examplePath, "utf8")) as object },
];
let failed = false;
for (const { label, record } of records) {
  if (validate(record)) {
    console.log(`Schema OK: ${label}`);
  } else {
    failed = true;
    console.error(`Schema FAILED: ${label}`, JSON.stringify(validate.errors, null, 2));
  }
}
console.log("Output:", outputPath);
process.exit(failed ? 1 : 0);
