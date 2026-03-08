import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const tempDir = path.join(pokerogueRoot, "test", ".external-rl");
const tempTestPath = path.join(tempDir, "experience-collector.test.ts");

const defaultConfigPath = path.join(repoRoot, "data", "rl", "collector-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

if (!existsSync(configPath)) {
  throw new Error(`Collector config not found: ${configPath}`);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = path.dirname(configPath);

const outputPath = config.output_path
  ? path.resolve(configDir, config.output_path)
  : path.join(repoRoot, "data", "rl", "combat", "train.jsonl");

const scenarioPaths = resolveScenarioPaths(config, configDir);
const scenarios = scenarioPaths.map(p => {
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  return {
    ...parsed,
    __scenario_name: path.basename(p, ".json"),
  };
});

if (scenarios.length === 0) {
  throw new Error("No scenario files resolved for collector run");
}

const seeds = Array.isArray(config.seeds) && config.seeds.length > 0
  ? config.seeds.map(String)
  : [null];
const episodesPerSeed = Number.isInteger(config.episodes_per_seed) ? config.episodes_per_seed : 1;
const maxStepsPerEpisode = Number.isInteger(config.max_steps_per_episode) ? config.max_steps_per_episode : 64;
const policy = config.policy ?? { type: "random", epsilon: 1.0 };
const appendOutput = config.append_output !== false;

mkdirSync(path.dirname(outputPath), { recursive: true });
if (!appendOutput && existsSync(outputPath)) {
  unlinkSync(outputPath);
}

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { BattlerIndex } from "#enums/battler-index";
import { Command } from "#enums/command";
import { MoveUseMode } from "#enums/move-use-mode";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { GameManager } from "#test/test-utils/game-manager";
import { beforeAll, describe, it } from "vitest";

const SCENARIOS = ${JSON.stringify(scenarios)};
const SEEDS = ${JSON.stringify(seeds)};
const EPISODES_PER_SEED = ${episodesPerSeed};
const MAX_STEPS_PER_EPISODE = ${maxStepsPerEpisode};
const POLICY = ${JSON.stringify(policy)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};

function getHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function buildObservation(game: GameManager) {
  const player = game.scene.getPlayerPokemon();
  const enemy = game.scene.getEnemyPokemon();
  if (!player || !enemy) {
    throw new Error("Missing active battlers while building observation");
  }

  const moves = player.getMoveset().slice(0, 4).map(move => {
    const moveData = move.getMove();
    const ppMax = move.getMovePp();
    const ppUsed = Number.isFinite(move.ppUsed) ? move.ppUsed : 0;
    const ppLeft = Math.max(0, ppMax - ppUsed);
    return {
      move_id: move.moveId,
      pp_left: ppLeft,
      pp_max: ppMax,
      power: moveData.power ?? 0,
      accuracy: moveData.accuracy ?? 0,
    };
  });

  const actionMask = [0, 0, 0, 0];
  for (let idx = 0; idx < moves.length; idx += 1) {
    // v1 conservative mask: every present move slot is selectable
    actionMask[idx] = 1;
  }

  return {
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    player_hp_ratio: getHpRatio(player.hp, player.getMaxHp()),
    enemy_hp_ratio: getHpRatio(enemy.hp, enemy.getMaxHp()),
    player_level: player.level,
    enemy_level: enemy.level,
    moves,
    action_mask: actionMask,
  };
}

function deriveTerminalNextState(state: any, enemyFainted: boolean, playerFainted: boolean) {
  return {
    ...state,
    player_hp_ratio: playerFainted ? 0 : state.player_hp_ratio,
    enemy_hp_ratio: enemyFainted ? 0 : state.enemy_hp_ratio,
  };
}

function selectMoveByIndex(game: GameManager, actionIndex: number) {
  game.onNextPrompt("CommandPhase", UiMode.COMMAND, () => {
    game.scene.ui.setMode(
      UiMode.FIGHT,
      (game.scene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex(),
    );
  });

  game.onNextPrompt("CommandPhase", UiMode.FIGHT, () => {
    (game.scene.phaseManager.getCurrentPhase() as CommandPhase).handleCommand(
      Command.FIGHT,
      actionIndex,
      MoveUseMode.NORMAL,
    );
  });

  game.selectTarget(actionIndex, BattlerIndex.ENEMY);
}

function computeScheduledEpsilon(globalEpisodeIndex: number): number {
  if (POLICY.type !== "epsilon_random") {
    return Number.isFinite(POLICY.epsilon) ? POLICY.epsilon : 1.0;
  }

  const start = Number.isFinite(POLICY.start_epsilon) ? POLICY.start_epsilon : 1.0;
  const end = Number.isFinite(POLICY.end_epsilon) ? POLICY.end_epsilon : 0.05;
  const decayEpisodes = Number.isFinite(POLICY.decay_episodes) && POLICY.decay_episodes > 0
    ? POLICY.decay_episodes
    : 100;

  const progress = Math.max(0, Math.min(1, globalEpisodeIndex / decayEpisodes));
  return start + (end - start) * progress;
}

function selectActionFromMask(actionMask: number[], globalEpisodeIndex: number): number {
  const valid = actionMask
    .map((value, index) => ({ value, index }))
    .filter(entry => entry.value === 1)
    .map(entry => entry.index);

  if (valid.length === 0) {
    return -1;
  }

  if (POLICY.type === "random") {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  if (POLICY.type === "epsilon_random") {
    const epsilon = computeScheduledEpsilon(globalEpisodeIndex);
    if (Math.random() < epsilon) {
      return valid[Math.floor(Math.random() * valid.length)];
    }
    return valid[0];
  }

  return valid[0];
}

function applyScenarioOverrides(game: GameManager, scenario: any, seedOverride: string | null) {
  const lead = scenario.player_team?.[0] ?? {};
  const enemy = scenario.enemy ?? {};
  const effectiveSeed = seedOverride ?? scenario.seed;

  game.override.disableTrainerWaves();

  if (effectiveSeed) {
    game.override.seed(effectiveSeed);
  }

  if (Number.isFinite(scenario.wave)) {
    game.override.startingWave(scenario.wave);
  }

  if (lead.level) {
    game.override.startingLevel(lead.level);
  }
  if (Number.isInteger(lead.nature)) {
    game.override.nature(lead.nature);
  }
  if (Number.isInteger(lead.ability_index)) {
    game.override.ability(lead.ability_index);
  }
  if (Array.isArray(lead.ivs) && lead.ivs.length === 6) {
    game.override.playerIVs(lead.ivs);
  }
  if (Array.isArray(lead.moveset) && lead.moveset.length > 0) {
    game.override.moveset(lead.moveset);
  }
  if (Array.isArray(lead.held_items) && lead.held_items.length > 0) {
    game.override.startingHeldItems(lead.held_items);
  }

  if (enemy.species_id) {
    game.override.enemySpecies(enemy.species_id);
  }
  if (enemy.level) {
    game.override.enemyLevel(enemy.level);
  }
  if (Number.isInteger(enemy.nature)) {
    game.override.enemyNature(enemy.nature);
  }
  if (Number.isInteger(enemy.ability_index)) {
    game.override.enemyAbility(enemy.ability_index);
  }
  if (Array.isArray(enemy.ivs) && enemy.ivs.length === 6) {
    game.override.enemyIVs(enemy.ivs);
  }
  if (Array.isArray(enemy.moveset) && enemy.moveset.length > 0) {
    game.override.enemyMoveset(enemy.moveset);
  }
  if (Array.isArray(enemy.held_items) && enemy.held_items.length > 0) {
    game.override.enemyHeldItems(enemy.held_items);
  }
}

describe("external combat batch collector", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  it("collects multi-step transitions across scenarios", async () => {
    let totalTransitions = 0;
    let totalEpisodes = 0;
    let globalEpisodeIndex = 0;

    for (const scenario of SCENARIOS) {
      for (const seedOverride of SEEDS) {
        for (let episodeIndex = 0; episodeIndex < EPISODES_PER_SEED; episodeIndex += 1) {
          const game = new GameManager(phaserGame);
          try {
            applyScenarioOverrides(game, scenario, seedOverride);

            const teamSpecies = scenario.player_team.map(member => member.species_id);
            await game.classicMode.startBattle(teamSpecies);

            const episodeId = \`\${scenario.__scenario_name}::\${seedOverride ?? scenario.seed ?? "seedless"}::\${episodeIndex}\`;
            const effectiveSeed = seedOverride ?? scenario.seed ?? "seedless";

            for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_EPISODE; stepIndex += 1) {
              const state = buildObservation(game);
              const action = selectActionFromMask(state.action_mask, globalEpisodeIndex);
              if (action < 0) {
                break;
              }

              const prevEnemyHp = state.enemy_hp_ratio;
              const prevPlayerHp = state.player_hp_ratio;

              selectMoveByIndex(game, action);
              await game.toEndOfTurn();

              const enemyPokemon = game.scene.getEnemyPokemon();
              const playerPokemon = game.scene.getPlayerPokemon();
              const enemyFainted = !enemyPokemon || enemyPokemon.hp <= 0 || enemyPokemon.isFainted();
              const playerFainted = !playerPokemon || playerPokemon.hp <= 0 || playerPokemon.isFainted();
              let done = enemyFainted || playerFainted || game.isVictory();

              if (!done) {
                await game.toNextTurn();
              }

              const nextState = done
                ? deriveTerminalNextState(state, enemyFainted, playerFainted)
                : buildObservation(game);
              let reward = (prevEnemyHp - nextState.enemy_hp_ratio) * 2.0 - (prevPlayerHp - nextState.player_hp_ratio) * 1.5;
              if (enemyFainted) reward += 1.5;
              if (playerFainted) reward -= 1.5;

              if (!done && stepIndex === MAX_STEPS_PER_EPISODE - 1) {
                done = true;
              }

              const record = {
                episode_id: episodeId,
                step_index: stepIndex,
                state,
                action,
                reward,
                next_state: nextState,
                done,
                meta: {
                  seed: effectiveSeed,
                  wave: game.scene.currentBattle.waveIndex,
                  battle_type: "single",
                  scenario: scenario.__scenario_name,
                },
                timestamp: Date.now(),
              };

              fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
              fs.appendFileSync(OUTPUT_PATH, \`\${JSON.stringify(record)}\\n\`, { encoding: "utf8" });
              totalTransitions += 1;

              if (done) {
                break;
              }
            }

            totalEpisodes += 1;
            globalEpisodeIndex += 1;
          } finally {
            game.phaseInterceptor.restoreOg();
          }
        }
      }
    }

    console.log(\`Collected episodes: \${totalEpisodes}\`);
    console.log(\`Collected transitions: \${totalTransitions}\`);
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
  ["vitest", "run", "test/.external-rl/experience-collector.test.ts", "--no-isolate"],
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

if (result.status !== 0 && !existsSync(outputPath)) {
  process.exit(result.status ?? 1);
}

if (existsSync(outputPath)) {
  const lineCount = readFileSync(outputPath, "utf8")
    .split("\n")
    .filter(Boolean).length;
  console.log("Collector output:", outputPath);
  console.log("Transition lines:", lineCount);
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but output exists. Continuing.");
}

function resolveScenarioPaths(runConfig, runConfigDir) {
  if (Array.isArray(runConfig.scenario_files) && runConfig.scenario_files.length > 0) {
    return runConfig.scenario_files.map(p => path.resolve(runConfigDir, p));
  }

  const scenarioDir = runConfig.scenario_dir
    ? path.resolve(runConfigDir, runConfig.scenario_dir)
    : path.join(repoRoot, "data", "rl", "scenarios");

  if (!existsSync(scenarioDir)) {
    return [];
  }

  return readdirSync(scenarioDir)
    .filter(name => name.endsWith(".json"))
    .map(name => path.join(scenarioDir, name));
}
