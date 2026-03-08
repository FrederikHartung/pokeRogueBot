import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const tempDir = path.join(pokerogueRoot, "test", ".external-rl");
const tempTestPath = path.join(tempDir, "scenario-generator.test.ts");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "scenario-generator-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

if (!existsSync(configPath)) {
  throw new Error(`Scenario generator config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);

const outputDir = config.output_dir
  ? path.resolve(configDir, config.output_dir)
  : path.join(repoRoot, "data", "rl", "scenarios", "generated");

if (config.clear_output_dir !== false && existsSync(outputDir)) {
  for (const name of readdirSync(outputDir)) {
    if (name.endsWith(".json")) {
      rmSync(path.join(outputDir, name), { force: true });
    }
  }
}
mkdirSync(outputDir, { recursive: true });

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { BattleType } from "#enums/battle-type";
import { GameManager } from "#test/test-utils/game-manager";
import { beforeAll, describe, it } from "vitest";

const CONFIG = ${JSON.stringify(config)};
const OUTPUT_DIR = ${JSON.stringify(outputDir)};

function sanitizeForFile(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function toMoveset(pokemon: any): number[] {
  const ids = pokemon
    .getMoveset()
    .slice(0, 4)
    .map((entry: any) => entry.moveId)
    .filter((moveId: number) => Number.isInteger(moveId) && moveId > 0);
  return ids.length > 0 ? ids : [33];
}

function toIvs(pokemon: any): number[] {
  if (Array.isArray(pokemon.ivs) && pokemon.ivs.length === 6) {
    return pokemon.ivs.map((value: number) => Number(value));
  }
  return [31, 31, 31, 31, 31, 31];
}

function toMember(pokemon: any): any {
  return {
    species_id: pokemon.species.speciesId,
    level: pokemon.level,
    nature: Number.isInteger(pokemon.nature) ? pokemon.nature : 0,
    ability_index: Number.isInteger(pokemon.abilityIndex) ? pokemon.abilityIndex : 0,
    ivs: toIvs(pokemon),
    moveset: toMoveset(pokemon),
  };
}

function applyGenerationOverrides(game: GameManager, seed: string, wave: number) {
  game.override.seed(seed);
  game.override.startingWave(wave);

  if (Number.isInteger(CONFIG.starting_level) && CONFIG.starting_level > 0) {
    game.override.startingLevel(CONFIG.starting_level);
  }

  if (Array.isArray(CONFIG.player_moveset) && CONFIG.player_moveset.length > 0) {
    game.override.moveset(CONFIG.player_moveset);
  }

  if (CONFIG.battle_mode === "wild") {
    game.override.battleType(BattleType.WILD);
  } else if (CONFIG.battle_mode === "trainer") {
    game.override.battleType(BattleType.TRAINER);
  } else if (CONFIG.disable_trainer_waves === true) {
    game.override.disableTrainerWaves();
  }

  if (CONFIG.random_trainer && Number.isInteger(CONFIG.random_trainer.trainer_type)) {
    game.override.randomTrainer({
      trainerType: CONFIG.random_trainer.trainer_type,
      trainerVariant: Number.isInteger(CONFIG.random_trainer.trainer_variant)
        ? CONFIG.random_trainer.trainer_variant
        : undefined,
    });
  }
}

describe("external scenario generator", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  it("generates scenario json files from seed x wave", async () => {
    const seeds = Array.isArray(CONFIG.seeds) && CONFIG.seeds.length > 0 ? CONFIG.seeds.map(String) : ["gen-seed-001"];
    const waveStart = Number.isInteger(CONFIG.wave_start) ? CONFIG.wave_start : 1;
    const waveEnd = Number.isInteger(CONFIG.wave_end) ? CONFIG.wave_end : waveStart;
    const teamSpecies = Array.isArray(CONFIG.team_species) && CONFIG.team_species.length > 0
      ? CONFIG.team_species
      : [1, 4, 7];

    let writtenCount = 0;
    let skippedDouble = 0;
    let skippedMissingBattlers = 0;

    for (const seed of seeds) {
      for (let wave = waveStart; wave <= waveEnd; wave += 1) {
        const game = new GameManager(phaserGame);

        try {
          applyGenerationOverrides(game, seed, wave);
          await game.classicMode.startBattle(teamSpecies);

          if (CONFIG.skip_double_battles !== false && game.scene.currentBattle.double) {
            skippedDouble += 1;
            continue;
          }

          const playerParty = game.scene.getPlayerParty().slice(0, 3);
          const enemyLead = game.scene.getEnemyPokemon();

          if (playerParty.length === 0 || !enemyLead) {
            skippedMissingBattlers += 1;
            continue;
          }

          const scenario = {
            seed,
            wave: game.scene.currentBattle.waveIndex,
            battle_type: "single",
            player_team: playerParty.map(toMember),
            enemy: toMember(enemyLead),
          };

          const modeName = typeof CONFIG.battle_mode === "string" ? CONFIG.battle_mode : "auto";
          const scenarioName = modeName + "-w" + scenario.wave + "-" + sanitizeForFile(seed) + ".json";
          const fullPath = path.join(OUTPUT_DIR, scenarioName);
          fs.writeFileSync(fullPath, JSON.stringify(scenario, null, 2) + "\\n", { encoding: "utf8" });
          writtenCount += 1;
        } finally {
          game.phaseInterceptor.restoreOg();
        }
      }
    }

    console.log("Scenario output dir: " + OUTPUT_DIR);
    console.log("Scenario files written: " + writtenCount);
    console.log("Skipped (double battles): " + skippedDouble);
    console.log("Skipped (missing battlers): " + skippedMissingBattlers);
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
  ["vitest", "run", "test/.external-rl/scenario-generator.test.ts", "--no-isolate"],
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
  // Cleanup is best-effort.
}

const scenarioCount = existsSync(outputDir)
  ? readdirSync(outputDir).filter(name => name.endsWith(".json")).length
  : 0;

if (result.status !== 0 && scenarioCount === 0) {
  process.exit(result.status ?? 1);
}

console.log("Generated scenarios:", scenarioCount);
console.log("Scenario output:", outputDir);

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but scenario output exists. Continuing.");
}
