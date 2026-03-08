import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const tempDir = path.join(pokerogueRoot, "test", ".external-rl");
const tempTestPath = path.join(tempDir, "starter-defaults.test.ts");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, "data", "rl", "combat", "starter-defaults.json");

const seed = process.argv[3] ?? "starter-defaults-seed";

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/test-utils/game-manager";
import { generateStarters } from "#test/test-utils/game-manager-utils";
import { afterEach, beforeAll, beforeEach, describe, it } from "vitest";

describe("starter defaults dump", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override.normalizeIVs = false;
    game.override.normalizeNatures = false;
    game.override.disableShinies = false;
    game.override.seed(${JSON.stringify(seed)});
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  it("writes starter defaults for Bulbasaur/Charmander/Squirtle", async () => {
    await game.runToTitle();
    const starters = generateStarters(game.scene, [SpeciesId.BULBASAUR, SpeciesId.CHARMANDER, SpeciesId.SQUIRTLE]);

    const starterDump = starters.map(starter => ({
      species_id: starter.speciesId,
      species_name: SpeciesId[starter.speciesId],
      level: game.scene.gameMode.getStartingLevel(),
      form_index: starter.formIndex,
      nature: starter.nature,
      ability_index: starter.abilityIndex,
      ivs: starter.ivs,
      shiny: starter.shiny,
      variant: starter.variant,
      pokerus: starter.pokerus,
      moveset: starter.moveset ?? [],
    }));

    const payload = {
      seed: ${JSON.stringify(seed)},
      wave: 1,
      timestamp: Date.now(),
      starters: starterDump,
    };

    const outputPath = ${JSON.stringify(outputPath)};
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), { encoding: "utf8" });
  });
});
`;

mkdirSync(tempDir, { recursive: true });
writeFileSync(tempTestPath, testSource, { encoding: "utf8" });

const runnerEnv = {
  ...process.env,
  PATH: `/opt/homebrew/opt/node@24/bin:${process.env.PATH ?? ""}`,
};

const result = spawnSync(
  "npx",
  ["vitest", "run", "test/.external-rl/starter-defaults.test.ts", "--no-isolate"],
  {
    cwd: pokerogueRoot,
    env: runnerEnv,
    stdio: "inherit",
  },
);

try {
  rmSync(tempTestPath, { force: true });
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // best-effort cleanup
}

if (result.status !== 0 && !existsSync(outputPath)) {
  process.exit(result.status ?? 1);
}

if (existsSync(outputPath)) {
  const data = JSON.parse(readFileSync(outputPath, "utf8"));
  console.log("Starter defaults written to:", outputPath);
  console.log("Seed:", data.seed);
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}
