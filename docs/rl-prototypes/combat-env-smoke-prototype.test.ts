import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/test-utils/game-manager";
import { CombatRlEnvironment } from "#test/test-utils/rl/combat-env";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("CombatRlEnvironment", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;
  let env: CombatRlEnvironment;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override.disableTrainerWaves().enemyMoveset(MoveId.SPLASH);
    env = new CombatRlEnvironment(game);
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  it("should reset and produce one valid transition", async () => {
    const state = await env.reset({
      starterSpecies: [SpeciesId.BIDOOF],
      seed: "combat-env-smoke",
      enemyMoveset: MoveId.SPLASH,
    });

    const action = state.actionMask.findIndex(value => value === 1);
    expect(action).toBeGreaterThanOrEqual(0);

    const transition = await env.step(action);

    expect(transition.state.moves.length).toBeGreaterThan(0);
    expect(transition.action).toBe(action);
    expect(Number.isFinite(transition.reward)).toBe(true);
    expect(Array.isArray(transition.nextState.actionMask)).toBe(true);
  });
});
