import { Command } from "#enums/command";
import { MoveId } from "#enums/move-id";
import type { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import { BattlerIndex } from "#enums/battler-index";
import { MoveUseMode } from "#enums/move-use-mode";
import type { CommandPhase } from "#phases/command-phase";
import type { GameManager } from "#test/test-utils/game-manager";

export interface CombatMoveState {
  moveId: number;
  ppLeft: number;
  ppMax: number;
  power: number;
  accuracy: number;
}

export interface CombatObservation {
  waveIndex: number;
  turnIndex: number;
  isDoubleBattle: boolean;
  playerHpRatio: number;
  enemyHpRatio: number;
  playerLevel: number;
  enemyLevel: number;
  moves: CombatMoveState[];
  actionMask: number[];
}

export interface CombatStepInfo {
  battleEnded: boolean;
  playerFainted: boolean;
  enemyFainted: boolean;
}

export interface CombatTransition {
  state: CombatObservation;
  action: number;
  reward: number;
  nextState: CombatObservation;
  done: boolean;
  info: CombatStepInfo;
}

export interface CombatResetOptions {
  starterSpecies: SpeciesId[];
  seed?: string;
  enemyMoveset?: MoveId | MoveId[];
}

const MAX_MOVE_SLOTS = 4;

/**
 * Minimal RL-style combat environment for single-battle training loops.
 * Built on top of existing headless test utilities.
 */
export class CombatRlEnvironment {
  constructor(private readonly game: GameManager) {}

  async reset(options: CombatResetOptions): Promise<CombatObservation> {
    this.game.override.disableTrainerWaves();
    this.game.override.enemyMoveset(options.enemyMoveset ?? MoveId.SPLASH);

    if (options.seed) {
      this.game.override.seed(options.seed);
    }

    await this.game.classicMode.startBattle(options.starterSpecies);

    if (this.game.scene.currentBattle.double) {
      throw new Error("CombatRlEnvironment currently supports single battles only");
    }

    return this.buildObservation();
  }

  async step(actionIndex: number): Promise<CombatTransition> {
    this.assertSingleBattle();
    const state = this.buildObservation();
    const clampedAction = this.validateAction(actionIndex, state.actionMask);

    const prevEnemyHpRatio = state.enemyHpRatio;
    const prevPlayerHpRatio = state.playerHpRatio;

    this.queueMoveSelection(clampedAction);
    await this.game.toEndOfTurn();

    const enemyFainted = this.isEnemyFainted();
    const playerFainted = this.isPlayerFainted();
    const done = enemyFainted || playerFainted || this.game.isVictory();

    if (!done) {
      await this.game.toNextTurn();
    }

    const nextState = this.buildObservation();
    const reward = this.calculateReward(prevPlayerHpRatio, prevEnemyHpRatio, nextState, done, enemyFainted, playerFainted);

    return {
      state,
      action: clampedAction,
      reward,
      nextState,
      done,
      info: {
        battleEnded: done,
        playerFainted,
        enemyFainted,
      },
    };
  }

  private buildObservation(): CombatObservation {
    this.assertSingleBattle();
    const playerPokemon = this.game.scene.getPlayerPokemon();
    const enemyPokemon = this.game.scene.getEnemyPokemon();

    if (!playerPokemon || !enemyPokemon) {
      throw new Error("Unable to build observation: missing active battlers");
    }

    const moveset = playerPokemon.getMoveset();
    const moves: CombatMoveState[] = [];
    const actionMask = Array.from({ length: MAX_MOVE_SLOTS }, () => 0);

    for (let idx = 0; idx < Math.min(moveset.length, MAX_MOVE_SLOTS); idx += 1) {
      const move = moveset[idx];
      const moveData = move.getMove();
      const ppMax = move.getMovePp();
      const ppLeft = Math.max(0, ppMax - move.ppUsed);

      moves.push({
        moveId: move.moveId,
        ppLeft,
        ppMax,
        power: moveData.power ?? 0,
        accuracy: moveData.accuracy ?? 0,
      });
      actionMask[idx] = ppLeft > 0 ? 1 : 0;
    }

    return {
      waveIndex: this.game.scene.currentBattle.waveIndex,
      turnIndex: this.game.scene.currentBattle.turn,
      isDoubleBattle: false,
      playerHpRatio: this.getHpRatio(playerPokemon.hp, playerPokemon.getMaxHp()),
      enemyHpRatio: this.getHpRatio(enemyPokemon.hp, enemyPokemon.getMaxHp()),
      playerLevel: playerPokemon.level,
      enemyLevel: enemyPokemon.level,
      moves,
      actionMask,
    };
  }

  private queueMoveSelection(actionIndex: number): void {
    this.game.onNextPrompt("CommandPhase", UiMode.COMMAND, () => {
      this.game.scene.ui.setMode(
        UiMode.FIGHT,
        (this.game.scene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex(),
      );
    });

    this.game.onNextPrompt("CommandPhase", UiMode.FIGHT, () => {
      (this.game.scene.phaseManager.getCurrentPhase() as CommandPhase).handleCommand(
        Command.FIGHT,
        actionIndex,
        MoveUseMode.NORMAL,
      );
    });

    this.game.selectTarget(actionIndex, BattlerIndex.ENEMY);
  }

  private validateAction(actionIndex: number, actionMask: number[]): number {
    if (!Number.isInteger(actionIndex)) {
      throw new Error(`Action must be an integer, got ${actionIndex}`);
    }

    if (actionIndex < 0 || actionIndex >= MAX_MOVE_SLOTS) {
      throw new Error(`Action out of bounds: ${actionIndex}`);
    }

    if (actionMask[actionIndex] !== 1) {
      throw new Error(`Action ${actionIndex} is currently invalid`);
    }

    return actionIndex;
  }

  private calculateReward(
    prevPlayerHpRatio: number,
    prevEnemyHpRatio: number,
    nextState: CombatObservation,
    done: boolean,
    enemyFainted: boolean,
    playerFainted: boolean,
  ): number {
    const enemyDamageReward = (prevEnemyHpRatio - nextState.enemyHpRatio) * 2.0;
    const selfDamagePenalty = (prevPlayerHpRatio - nextState.playerHpRatio) * 1.5;

    let reward = enemyDamageReward - selfDamagePenalty;

    if (enemyFainted) {
      reward += 1.0;
    }

    if (playerFainted) {
      reward -= 1.0;
    }

    if (done) {
      reward += enemyFainted ? 0.5 : 0.0;
      reward -= playerFainted ? 0.5 : 0.0;
    }

    return reward;
  }

  private isEnemyFainted(): boolean {
    const enemy = this.game.scene.getEnemyPokemon();
    return !enemy || enemy.hp <= 0 || enemy.isFainted();
  }

  private isPlayerFainted(): boolean {
    const player = this.game.scene.getPlayerPokemon();
    return !player || player.hp <= 0 || player.isFainted();
  }

  private getHpRatio(hp: number, maxHp: number): number {
    if (maxHp <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, hp / maxHp));
  }

  private assertSingleBattle(): void {
    if (this.game.scene.currentBattle?.double) {
      throw new Error("CombatRlEnvironment only supports single battles");
    }
  }
}
