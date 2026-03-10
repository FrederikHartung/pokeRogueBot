import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const tempDir = path.join(pokerogueRoot, "test", ".external-rl");
const tempTestPath = path.join(tempDir, "experience-poc.test.ts");

const defaultScenario = {
  seed: "poc-seed-001",
  wave: 1,
  player_team: [
    {
      species_id: 399,
      level: 5,
      nature: 0,
      ability_index: 0,
      ivs: [31, 31, 31, 31, 31, 31],
      moveset: [150],
    },
  ],
  enemy: {
    species_id: 21,
    level: 2,
    nature: 0,
    ability_index: 0,
    ivs: [31, 31, 31, 31, 31, 31],
    moveset: [150],
  },
  battle_type: "single",
};

const arg1 = process.argv[2];
const arg2 = process.argv[3];

let scenarioPath;
let outputPath;

if (arg1 && arg1.endsWith(".json")) {
  scenarioPath = path.resolve(arg1);
  outputPath = arg2 ? path.resolve(arg2) : path.join(repoRoot, "data", "rl", "combat", "poc.jsonl");
} else {
  scenarioPath = path.join(repoRoot, "data", "rl", "scenarios", "poc-battle.json");
  outputPath = arg1 ? path.resolve(arg1) : path.join(repoRoot, "data", "rl", "combat", "poc.jsonl");
}

let scenario = defaultScenario;
if (existsSync(scenarioPath)) {
  scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
}

if (!Array.isArray(scenario.player_team) || scenario.player_team.length === 0) {
  throw new Error("Scenario must contain at least one entry in player_team");
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
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SCENARIO = ${JSON.stringify(scenario)};

function getHpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function setPokemonHpRatio(pokemon: any, ratio: number) {
  if (!pokemon || !Number.isFinite(ratio)) return;
  const maxHp = pokemon.getMaxHp();
  if (!Number.isFinite(maxHp) || maxHp <= 0) return;
  let nextHp = Math.round(maxHp * ratio);
  if (ratio > 0 && nextHp <= 0) {
    nextHp = 1;
  }
  pokemon.hp = Math.max(0, Math.min(maxHp, nextHp));
}

function applyScenarioHpRatios(game: GameManager) {
  const party = game.scene.getPlayerParty();
  const scenarioTeam = Array.isArray(SCENARIO.player_team) ? SCENARIO.player_team : [];
  for (let idx = 0; idx < scenarioTeam.length; idx += 1) {
    const ratio = scenarioTeam[idx]?.hp_ratio;
    if (Number.isFinite(ratio)) {
      setPokemonHpRatio(party[idx], Number(ratio));
    }
  }

  const enemyRatio = SCENARIO?.enemy?.hp_ratio;
  if (Number.isFinite(enemyRatio)) {
    setPokemonHpRatio(game.scene.getEnemyPokemon(), Number(enemyRatio));
  }
}

function buildObservation(game: GameManager) {
  const player = game.scene.getPlayerPokemon();
  const enemy = game.scene.getEnemyPokemon();
  if (!player || !enemy) {
    throw new Error("Missing active battlers while building observation");
  }

  const playerTypes = player
    .getTypes(true, true)
    .filter(type => Number.isInteger(type) && type >= 0)
    .slice(0, 2);
  const enemyTypes = enemy
    .getTypes(true, true)
    .filter(type => Number.isInteger(type) && type >= 0)
    .slice(0, 2);

  const moveSet = player.getMoveset().slice(0, 4);
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
    actionMask[idx] = 1;
  }
  const moveEffectiveness = [0, 0, 0, 0];
  for (let idx = 0; idx < moveSet.length; idx += 1) {
    const moveData = moveSet[idx].getMove();
    const effectiveness = enemy.getMoveEffectiveness(player, moveData, false, true);
    moveEffectiveness[idx] = Number.isFinite(effectiveness) ? effectiveness : 1;
  }

  return {
    wave_index: game.scene.currentBattle.waveIndex,
    turn_index: game.scene.currentBattle.turn,
    player_hp_ratio: getHpRatio(player.hp, player.getMaxHp()),
    enemy_hp_ratio: getHpRatio(enemy.hp, enemy.getMaxHp()),
    player_level: player.level,
    enemy_level: enemy.level,
    player_types: playerTypes,
    enemy_types: enemyTypes,
    moves,
    move_effectiveness: moveEffectiveness,
    action_mask: actionMask,
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

describe("external combat experience poc", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);

    game.override.disableTrainerWaves();

    if (SCENARIO.seed) {
      game.override.seed(SCENARIO.seed);
    }

    if (Number.isFinite(SCENARIO.wave)) {
      game.override.startingWave(SCENARIO.wave);
    }

    const lead = SCENARIO.player_team?.[0] ?? {};
    const enemy = SCENARIO.enemy ?? {};

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
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  it("generates one transition and appends it as JSONL", async () => {
    const teamSpecies = SCENARIO.player_team.map(member => member.species_id);
    await game.classicMode.startBattle(teamSpecies);
    applyScenarioHpRatios(game);
    expect(game.scene.currentBattle.double).toBe(false);

    const state = buildObservation(game);
    const action = state.action_mask.findIndex(v => v === 1);
    expect(action).toBeGreaterThanOrEqual(0);

    const prevEnemyHp = state.enemy_hp_ratio;
    const prevPlayerHp = state.player_hp_ratio;

    selectMoveByIndex(game, action);
    await game.toEndOfTurn();

    const enemy = game.scene.getEnemyPokemon();
    const player = game.scene.getPlayerPokemon();
    const enemyFainted = !enemy || enemy.hp <= 0 || enemy.isFainted();
    const playerFainted = !player || player.hp <= 0 || player.isFainted();
    const done = enemyFainted || playerFainted || game.isVictory();

    if (!done) {
      await game.toNextTurn();
    }

    const nextState = buildObservation(game);
    let reward = (prevEnemyHp - nextState.enemy_hp_ratio) * 2.0 - (prevPlayerHp - nextState.player_hp_ratio) * 1.5;
    if (enemyFainted) reward += 1.5;
    if (playerFainted) reward -= 1.5;

    const record = {
      episode_id: SCENARIO.seed ?? "poc-seed",
      step_index: 0,
      state,
      action,
      reward,
      next_state: nextState,
      done,
      meta: {
        seed: SCENARIO.seed ?? "poc-seed",
        wave: game.scene.currentBattle.waveIndex,
        battle_type: "single",
      },
      timestamp: Date.now(),
    };

    const outputPath = ${JSON.stringify(outputPath)};
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.appendFileSync(outputPath, \`\${JSON.stringify(record)}\\n\`, { encoding: "utf8" });
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
  ["vitest", "run", "test/.external-rl/experience-poc.test.ts", "--no-isolate"],
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

let wroteExperience = false;
if (existsSync(outputPath)) {
  const content = readFileSync(outputPath, "utf8").trim();
  wroteExperience = content.length > 0;
}

if (result.status !== 0 && !wroteExperience) {
  process.exit(result.status ?? 1);
}

if (wroteExperience) {
  console.log("Experience written to:", outputPath);
  console.log("Scenario used:", scenarioPath);
}

if (result.status !== 0) {
  console.log("Vitest exited non-zero, but experience output exists. Continuing.");
}
