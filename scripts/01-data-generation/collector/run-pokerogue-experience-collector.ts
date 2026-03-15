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
import { validatePolicyConfig } from "../rl-config/policy-contract.ts";
import { validateCollectorRunConfig } from "../rl-config/run-config-contract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const pokerogueRoot = path.join(repoRoot, "pokerogue");
const collectorTemplateRoot = path.join(__dirname, "templates");
const collectorHelpersTemplatePath = path.join(collectorTemplateRoot, "experience-collector.helpers.template.ts");
const pokerogueVitestBin = path.join(pokerogueRoot, "node_modules", ".bin", "vitest");
const tempRunId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const tempDir = path.join(pokerogueRoot, "test", ".external-rl", tempRunId);
const tempTestRelativePath = path.join("test", ".external-rl", tempRunId, "experience-collector.test.ts");
const tempTestPath = path.join(pokerogueRoot, tempTestRelativePath);
const tempHelpersRelativePath = path.join("test", ".external-rl", tempRunId, "experience-collector.helpers.ts");
const tempHelpersPath = path.join(pokerogueRoot, tempHelpersRelativePath);

const defaultConfigPath = path.join(repoRoot, "data", "rl", "collector-run.json");
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultConfigPath;

function assertScenarioV2(scenario, sourcePath) {
  const hasSource = scenario?.source != null;
  const hasWaveIndex = Number.isInteger(scenario?.wave_index);
  const hasBattleType = typeof scenario?.battle_type === "string" && scenario.battle_type.length > 0;
  const hasBattleSpec = typeof scenario?.battle_spec === "string" && scenario.battle_spec.length > 0;
  const hasBattleStyle = typeof scenario?.battle_style === "string" && scenario.battle_style.length > 0;
  const hasDoubleFlag = typeof scenario?.is_double_fight === "boolean";
  const hasPlayerTeam = Array.isArray(scenario?.player_team) && scenario.player_team.length > 0;
  const hasEnemyTeam = Array.isArray(scenario?.enemy_team) && scenario.enemy_team.length > 0;

  if (hasSource && hasWaveIndex && hasBattleType && hasBattleSpec && hasBattleStyle && hasDoubleFlag && hasPlayerTeam && hasEnemyTeam) {
    return;
  }

  throw new Error(
    "Collector requires combat-scenario-v2 input. Invalid scenario: "
    + sourcePath
    + " (expected source, wave_index, battle_type, battle_spec, battle_style, is_double_fight, player_team, enemy_team)",
  );
}

if (!existsSync(configPath)) {
  throw new Error(`Collector config not found: ${configPath}`);
}

const config = validateCollectorRunConfig(JSON.parse(readFileSync(configPath, "utf8")), {
  context: configPath,
});
const configDir = path.dirname(configPath);

const outputPath = config.output_path
  ? path.resolve(configDir, config.output_path)
  : path.join(repoRoot, "data", "rl", "combat", "train.jsonl");

const scenarioPaths = resolveScenarioPaths(config, configDir);
const scenarios = scenarioPaths.map(p => {
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  assertScenarioV2(parsed, p);
  return {
    ...parsed,
    __scenario_name: path.basename(p, ".json"),
    __scenario_source_path: p,
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
const policy = validatePolicyConfig(config.policy ?? { type: "random" }, {
  context: `${configPath}:policy`,
});
const testTimeoutMs = Number.isInteger(config.test_timeout_ms) && config.test_timeout_ms > 0
  ? config.test_timeout_ms
  : 120000;
const rewardSwitchPenalty = Number.isFinite(config.reward_switch_penalty)
  ? Number(config.reward_switch_penalty)
  : -0.05;
const rewardStepPenalty = Number.isFinite(config.reward_step_penalty)
  ? Number(config.reward_step_penalty)
  : -0.05;
const rewardConsecutiveSwitchPenalty = Number.isFinite(config.reward_consecutive_switch_penalty)
  ? Number(config.reward_consecutive_switch_penalty)
  : -0.25;
const rewardDirectBackswitchPenalty = Number.isFinite(config.reward_direct_backswitch_penalty)
  ? Number(config.reward_direct_backswitch_penalty)
  : -0.35;
const rewardConsecutiveSwitchPenaltyScale = Number.isFinite(config.reward_consecutive_switch_penalty_scale)
  ? Number(config.reward_consecutive_switch_penalty_scale)
  : -0.15;
const rewardEnemyTeamHpDamageScale = Number.isFinite(config.reward_enemy_team_hp_damage_scale)
  ? Number(config.reward_enemy_team_hp_damage_scale)
  : 2.0;
const rewardPlayerTeamHpLossScale = Number.isFinite(config.reward_player_team_hp_loss_scale)
  ? Number(config.reward_player_team_hp_loss_scale)
  : -2.5;
const rewardEnemyFaintBonus = Number.isFinite(config.reward_enemy_faint_bonus)
  ? Number(config.reward_enemy_faint_bonus)
  : 1.5;
const rewardPlayerFaintPenalty = Number.isFinite(config.reward_player_faint_penalty)
  ? Number(config.reward_player_faint_penalty)
  : -4.0;
const rewardEnemyTeamDefeatBonus = Number.isFinite(config.reward_enemy_team_defeat_bonus)
  ? Number(config.reward_enemy_team_defeat_bonus)
  : 3.0;
const rewardPlayerTeamDefeatPenalty = Number.isFinite(config.reward_player_team_defeat_penalty)
  ? Number(config.reward_player_team_defeat_penalty)
  : -6.0;
const rewardAliveTeamMemberWinBonus = Number.isFinite(config.reward_alive_team_member_win_bonus)
  ? Number(config.reward_alive_team_member_win_bonus)
  : 1.0;
const rewardRemainingTeamHpRatioWinBonusScale = Number.isFinite(config.reward_remaining_team_hp_ratio_win_bonus_scale)
  ? Number(config.reward_remaining_team_hp_ratio_win_bonus_scale)
  : 2.0;
const terminalOnEggLapse = config.terminal_on_egg_lapse !== false;
const criticalHpRatio = 0.1;
const halfHpRatio = 0.5;
const stepTimeoutMs = Number.isFinite(policy.step_timeout_ms) && policy.step_timeout_ms > 0
  ? Number(policy.step_timeout_ms)
  : 15000;
const envProgressPauseEnabled = process.env.COLLECTOR_PROGRESS_PAUSE === "1";
const envProgressPauseTargetTransitions = Number.parseInt(process.env.COLLECTOR_PROGRESS_TARGET ?? "", 10);
const envProgressPausePercentStep = Number.parseInt(process.env.COLLECTOR_PROGRESS_STEP ?? "", 10);
const envProgressPauseMs = Number.parseInt(process.env.COLLECTOR_PROGRESS_PAUSE_MS ?? "", 10);
const progressPauseEnabled = config.progress_pause_enabled === true || envProgressPauseEnabled;
const progressPauseTargetTransitions = Number.isInteger(envProgressPauseTargetTransitions) && envProgressPauseTargetTransitions > 0
  ? envProgressPauseTargetTransitions
  : Number.isInteger(config.progress_pause_target_transitions) && config.progress_pause_target_transitions > 0
  ? config.progress_pause_target_transitions
  : 0;
const progressPausePercentStep = Number.isInteger(envProgressPausePercentStep) && envProgressPausePercentStep > 0
  ? envProgressPausePercentStep
  : Number.isInteger(config.progress_pause_percent_step) && config.progress_pause_percent_step > 0
  ? config.progress_pause_percent_step
  : 10;
const progressPauseMs = Number.isInteger(envProgressPauseMs) && envProgressPauseMs >= 0
  ? envProgressPauseMs
  : Number.isInteger(config.progress_pause_ms) && config.progress_pause_ms >= 0
  ? config.progress_pause_ms
  : 4000;
const appendOutput = config.append_output !== false;
const episodeIndexOffset = Number.isInteger(config.episode_index_offset) && config.episode_index_offset >= 0
  ? config.episode_index_offset
  : 0;
const stateVariants = Array.isArray(config.state_variants) && config.state_variants.length > 0
  ? config.state_variants.map(String)
  : [];
const quietGameLogs = config.quiet_game_logs === true || process.env.COLLECTOR_QUIET_GAME_LOGS === "1";
const plannedEpisodes = scenarios.length * seeds.length * episodesPerSeed;
const helperSource = materializeCollectorHelperSource(
  readFileSync(collectorHelpersTemplatePath, "utf8"),
  terminalOnEggLapse,
  stepTimeoutMs,
  plannedEpisodes,
  policy,
);

mkdirSync(path.dirname(outputPath), { recursive: true });
if (!appendOutput && existsSync(outputPath)) {
  unlinkSync(outputPath);
}

const testSource = `
import fs from "node:fs";
import path from "node:path";
import { allAbilities } from "#data/data-lists";
import { MoveCategory } from "#enums/move-category";
import { Nature } from "#enums/nature";
import { Stat } from "#enums/stat";
import { StatusEffect } from "#enums/status-effect";
import { TrainerSlot } from "#enums/trainer-slot";
import { UiMode } from "#enums/ui-mode";
import { getPokemonSpecies } from "#utils/pokemon-utils";
import { GameManager } from "#test/test-utils/game-manager";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  applyScenarioOverrides,
  applyStateVariant,
  applyScenarioMaterializedState,
  buildObservation,
  clearStalePromptsForForcedSwitch,
  accuracyBucket,
  actsFirstIfUsed,
  bucketByThresholds,
  cleanupPersistentExternalPolicyWorkers,
  computeTransitionReward,
  countAlivePlayerTeamMembers,
  countBucket,
  currentPhaseNameSafe,
  currentUiModeNameSafe,
  damageClassBucket,
  damageRatioBucket,
  deriveTerminalNextState,
  deriveTerminalOutcome,
  describePartyForDiagnostics,
  describePartyUiHandlerForDiagnostics,
  describePromptQueueForDiagnostics,
  drainTerminalPhase,
  effectivenessBucket,
  enemyHasKnownPriorityThreat,
  estimateDamageRatio,
  executeAction,
  findActivePartySlotIndex,
  getBestKnownEnemyPriority,
  getEffectiveSpeed,
  getHpRatio,
  getEnemyTeamHpRatio,
  getPlayerTeamHpRatio,
  hasRemainingPlayerTeam,
  hasLoggedTerminalPhaseSince,
  hpBucket,
  hpDiffBucket,
  isCollectorEpisodeTerminalPhase,
  isVictorySafe,
  koTurnsBucket,
  levelGapBucket,
  moveKindBucket,
  powerBucket,
  priorityBucket,
  requiresTerminalDrain,
  resolveForcedSwitchIfNeeded,
  resolveOptionalCheckSwitchIfNeeded,
  setPokemonHpAbsolute,
  setPokemonHpRatio,
  speedOrderAdvantage,
  startScenarioBattle,
  selectActionFromMask,
  waitForCommandOrTerminalAfterForcedSwitch,
  waitForPromiseOrTerminal,
  withTimeout,
  usesBestOffenseStat,
} from "./experience-collector.helpers";

const SCENARIOS = ${JSON.stringify(scenarios)};
const SEEDS = ${JSON.stringify(seeds)};
const EPISODES_PER_SEED = ${episodesPerSeed};
const MAX_STEPS_PER_EPISODE = ${maxStepsPerEpisode};
const POLICY = ${JSON.stringify(policy)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};
const TEST_TIMEOUT_MS = ${testTimeoutMs};
const EPISODE_INDEX_OFFSET = ${episodeIndexOffset};
const REWARD_SWITCH_PENALTY = ${rewardSwitchPenalty};
const REWARD_STEP_PENALTY = ${rewardStepPenalty};
const REWARD_CONSECUTIVE_SWITCH_PENALTY = ${rewardConsecutiveSwitchPenalty};
const REWARD_DIRECT_BACKSWITCH_PENALTY = ${rewardDirectBackswitchPenalty};
const REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE = ${rewardConsecutiveSwitchPenaltyScale};
const REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE = ${rewardEnemyTeamHpDamageScale};
const REWARD_PLAYER_TEAM_HP_LOSS_SCALE = ${rewardPlayerTeamHpLossScale};
const REWARD_ENEMY_FAINT_BONUS = ${rewardEnemyFaintBonus};
const REWARD_PLAYER_FAINT_PENALTY = ${rewardPlayerFaintPenalty};
const REWARD_ENEMY_TEAM_DEFEAT_BONUS = ${rewardEnemyTeamDefeatBonus};
const REWARD_PLAYER_TEAM_DEFEAT_PENALTY = ${rewardPlayerTeamDefeatPenalty};
const REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS = ${rewardAliveTeamMemberWinBonus};
const REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE = ${rewardRemainingTeamHpRatioWinBonusScale};
const TERMINAL_ON_EGG_LAPSE = ${terminalOnEggLapse};
const PROGRESS_PAUSE_ENABLED = ${progressPauseEnabled};
const PROGRESS_PAUSE_TARGET_TRANSITIONS = ${progressPauseTargetTransitions};
const PROGRESS_PAUSE_PERCENT_STEP = ${progressPausePercentStep};
const PROGRESS_PAUSE_MS = ${progressPauseMs};
const STATE_VARIANTS = ${JSON.stringify(stateVariants)};
const QUIET_GAME_LOGS = ${quietGameLogs};
const PLANNED_EPISODES = ${plannedEpisodes};
const STEP_TIMEOUT_MS = ${stepTimeoutMs};
const MOVE_ACTIONS = 4;
const SWITCH_ACTIONS = 6;
const ACTION_DIM = MOVE_ACTIONS + SWITCH_ACTIONS;
const CRITICAL_HP_RATIO = 0.1;
const persistentExternalPolicyWorkers = new Map<string, any>();
const HALF_HP_RATIO = 0.5;
const RAW_CONSOLE_LOG = console.log.bind(console);

function shouldSuppressGameLog(args: unknown[]): boolean {
  const joined = args
    .map(value => typeof value === "string" ? value : JSON.stringify(value))
    .join(" ")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trimStart();

  const noisyPrefixes = [
    "Start Phase ",
    "setMode ",
    "Move Pool:",
    "Move Scores:",
    "Sorted Move Pool:",
    "Chosen Move:",
    "Move:",
    "Player Pokemon:",
    "Pokemon:",
    "Stats (IVs):",
    "Ability:",
    "Moveset:",
    "crit stage:",
    "base damage",
    "damage ",
    "COMMON",
    "UNCOMMON",
    "RARE",
    "EPIC",
    "TACKLE NORMAL",
    "ASTONISH NORMAL",
    "use seasonal splash messages",
  ];

  return noisyPrefixes.some(prefix => joined.startsWith(prefix));
}

if (QUIET_GAME_LOGS) {
  console.log = (...args: unknown[]) => {
    if (shouldSuppressGameLog(args)) {
      return;
    }
    RAW_CONSOLE_LOG(...args);
  };
}

function assertScenarioV2(scenario: any, sourcePath: string): void {
  const hasSource = scenario?.source != null;
  const hasWaveIndex = Number.isInteger(scenario?.wave_index);
  const hasBattleType = typeof scenario?.battle_type === "string" && scenario.battle_type.length > 0;
  const hasBattleSpec = typeof scenario?.battle_spec === "string" && scenario.battle_spec.length > 0;
  const hasBattleStyle = typeof scenario?.battle_style === "string" && scenario.battle_style.length > 0;
  const hasDoubleFlag = typeof scenario?.is_double_fight === "boolean";
  const hasPlayerTeam = Array.isArray(scenario?.player_team) && scenario.player_team.length > 0;
  const hasEnemyTeam = Array.isArray(scenario?.enemy_team) && scenario.enemy_team.length > 0;

  if (hasSource && hasWaveIndex && hasBattleType && hasBattleSpec && hasBattleStyle && hasDoubleFlag && hasPlayerTeam && hasEnemyTeam) {
    return;
  }

  throw new Error(
    "Collector requires combat-scenario-v2 input. Invalid scenario: "
    + sourcePath
    + " (expected source, wave_index, battle_type, battle_spec, battle_style, is_double_fight, player_team, enemy_team)",
  );
}

function selectEpisodeStateVariant(globalEpisodeIndex: number): string | null {
  if (!Array.isArray(STATE_VARIANTS) || STATE_VARIANTS.length === 0) {
    return null;
  }
  return STATE_VARIANTS[globalEpisodeIndex % STATE_VARIANTS.length];
}

function currentWaveIndexSafe(game: GameManager, fallback: number = -1): number {
  const battle = game.scene.currentBattle;
  if (battle && Number.isFinite(battle.waveIndex)) {
    return battle.waveIndex;
  }
  return fallback;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

async function advanceAfterAction(game: GameManager): Promise<"ok" | "terminal" | "timeout"> {
  const terminalPhasesForTurnAdvance = [
    "GameOverPhase",
    "PostGameOverPhase",
    "TitlePhase",
    "BattleEndPhase",
    "SelectModifierPhase",
    "EggLapsePhase",
  ];
  const endOfTurnStatus = await waitForPromiseOrTerminal(
    game,
    withTimeout(game.toEndOfTurn(), STEP_TIMEOUT_MS, "end of turn"),
    STEP_TIMEOUT_MS,
  );
  if (endOfTurnStatus === "timeout" && game.isCurrentPhase("SwitchPhase")) {
    return waitForCommandOrTerminalAfterForcedSwitch(game, STEP_TIMEOUT_MS);
  }
  if (endOfTurnStatus !== "ok") {
    return endOfTurnStatus;
  }

  if (isCollectorEpisodeTerminalPhase(game)) {
    return "terminal";
  }

  const switchResolveStatus = resolveForcedSwitchIfNeeded(game);
  if (switchResolveStatus === "no_candidate") {
    return "terminal";
  }
  if (!hasRemainingPlayerTeam(game) || isVictorySafe(game)) {
    return "terminal";
  }
  if (game.isCurrentPhase("CommandPhase")) {
    return "ok";
  }

  const phaseLogStart = Array.isArray(game.phaseInterceptor.log) ? game.phaseInterceptor.log.length : 0;
  let nextTurnResolved = false;
  let nextTurnTerminal = false;
  let nextTurnFailed = false;
  const nextTurnPromise = game
    .toNextTurn(terminalPhasesForTurnAdvance)
    .then(result => {
      if (result === "terminal") {
        nextTurnTerminal = true;
      } else {
        nextTurnResolved = true;
      }
    })
    .catch(() => {
      nextTurnFailed = true;
    });

  const startedAt = Date.now();
  while (Date.now() - startedAt < STEP_TIMEOUT_MS) {
    resolveOptionalCheckSwitchIfNeeded(game);
    const forcedSwitchStatus = resolveForcedSwitchIfNeeded(game);
    if (forcedSwitchStatus === "no_candidate") {
      return "terminal";
    }
    if (nextTurnTerminal || isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
      return "terminal";
    }
    if (nextTurnResolved) {
      return "ok";
    }
    if (nextTurnFailed) {
      return isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart) ? "terminal" : "timeout";
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }

  if (isCollectorEpisodeTerminalPhase(game) || hasLoggedTerminalPhaseSince(game, phaseLogStart)) {
    return "terminal";
  }
  // Prevent unhandled rejection if toNextTurn fails after timeout return path.
  void nextTurnPromise;
  return "timeout";
}

describe("external combat collector", () => {
  let phaserGame: Phaser.Game;

  beforeAll(() => {
    phaserGame = new Phaser.Game({ type: Phaser.HEADLESS });
  });

  afterAll(() => {
    cleanupPersistentExternalPolicyWorkers();
  });

  it("collects multi-step transitions across scenarios", async () => {
    const runStartedAt = Date.now();
    let totalTransitions = 0;
    let totalEpisodes = 0;
    let globalEpisodeIndex = EPISODE_INDEX_OFFSET;
    let nextProgressPausePercent = PROGRESS_PAUSE_PERCENT_STEP;

    try {
      for (const scenario of SCENARIOS) {
        for (const seedOverride of SEEDS) {
          for (let episodeIndex = 0; episodeIndex < EPISODES_PER_SEED; episodeIndex += 1) {
            const game = new GameManager(phaserGame);
            try {
            applyScenarioOverrides(game, scenario, seedOverride);

            const teamSpecies = scenario.player_team.map(member => member.species_id);
            await startScenarioBattle(game, scenario, teamSpecies);
            applyScenarioMaterializedState(game, scenario);

            const episodeId = \`\${scenario.__scenario_name}::\${seedOverride ?? scenario.seed ?? "seedless"}::\${globalEpisodeIndex}\`;
            const effectiveSeed = seedOverride ?? scenario.seed ?? "seedless";
            const episodeStateVariant = selectEpisodeStateVariant(globalEpisodeIndex);
            applyStateVariant(game, episodeStateVariant, episodeId);
            let previousAction: number | null = null;
            let lastSwitchOriginPartyIndex: number | null = null;
            let consecutiveSwitchCount = 0;

              for (let stepIndex = 0; stepIndex < MAX_STEPS_PER_EPISODE; stepIndex += 1) {
              const state = buildObservation(game, scenario);
              const { action, actionSource } = await selectActionFromMask(state, state.action_mask, globalEpisodeIndex);
              if (action < 0) {
                break;
              }
              const playerTeamHpBeforeAction = getPlayerTeamHpRatio(game);
              const enemyTeamHpBeforeAction = getEnemyTeamHpRatio(game);

              const stepStartAt = Date.now();
              executeAction(game, action);
              const advanceStatus = await advanceAfterAction(game);
              const stepMs = Date.now() - stepStartAt;

              const enemyPokemon = game.scene.getEnemyPokemon();
              const playerPokemon = game.scene.getPlayerPokemon();
              const enemyFainted = !enemyPokemon || enemyPokemon.hp <= 0 || enemyPokemon.isFainted();
              const playerFainted = !playerPokemon || playerPokemon.hp <= 0 || playerPokemon.isFainted();
              const enemyTeamDefeated = isVictorySafe(game);
              const playerTeamDefeated = !hasRemainingPlayerTeam(game);
              const hardTerminalPhase = isCollectorEpisodeTerminalPhase(game);
              const timeoutTruncated = advanceStatus === "timeout";
              let done = enemyTeamDefeated || playerTeamDefeated || hardTerminalPhase || timeoutTruncated;
              const nextState = done
                ? deriveTerminalNextState(state, enemyTeamDefeated, playerTeamDefeated)
                : buildObservation(game, scenario);
              const nextPlayerTeamHp = playerTeamDefeated ? 0 : getPlayerTeamHpRatio(game);
              const nextEnemyTeamHp = enemyTeamDefeated ? 0 : getEnemyTeamHpRatio(game);
              const alivePlayerTeamMembers = countAlivePlayerTeamMembers(game);
              const activePartyIndexBeforeAction = findActivePartySlotIndex(state);
              const reward = computeTransitionReward({
                action,
                previousAction,
                consecutiveSwitchCount,
                lastSwitchOriginPartyIndex,
                enemyTeamHpBeforeAction,
                nextEnemyTeamHp,
                playerTeamHpBeforeAction,
                nextPlayerTeamHp,
                enemyFainted,
                playerFainted,
                enemyTeamDefeated,
                playerTeamDefeated,
                alivePlayerTeamMembers,
              });

              if (!done && stepIndex === MAX_STEPS_PER_EPISODE - 1) {
                done = true;
              }

              const terminalOutcome = deriveTerminalOutcome({
                enemyTeamDefeated,
                playerTeamDefeated,
                timeoutTruncated,
                done,
                stepIndex,
                maxStepsPerEpisode: MAX_STEPS_PER_EPISODE,
              });

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
                  wave: currentWaveIndexSafe(game, state.wave_index),
                  battle_type: "single",
                  scenario: scenario.__scenario_name,
                  state_variant: episodeStateVariant,
                  action_source: actionSource,
                  outcome: terminalOutcome,
                },
                timestamp: Date.now(),
              };

              fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
              fs.appendFileSync(OUTPUT_PATH, \`\${JSON.stringify(record)}\\n\`, { encoding: "utf8" });
              totalTransitions += 1;
              if (action >= MOVE_ACTIONS) {
                lastSwitchOriginPartyIndex = activePartyIndexBeforeAction >= 0 ? activePartyIndexBeforeAction : null;
                consecutiveSwitchCount += 1;
              } else {
                lastSwitchOriginPartyIndex = null;
                consecutiveSwitchCount = 0;
              }
              previousAction = action;
              if (
                PROGRESS_PAUSE_ENABLED
                && PROGRESS_PAUSE_TARGET_TRANSITIONS > 0
                && nextProgressPausePercent <= 100
              ) {
                const currentPercent = Math.floor((totalTransitions / PROGRESS_PAUSE_TARGET_TRANSITIONS) * 100);
                if (currentPercent >= nextProgressPausePercent) {
                  const elapsedMs = Date.now() - runStartedAt;
                  const estimatedTotalMs = totalTransitions > 0
                    ? (elapsedMs / totalTransitions) * PROGRESS_PAUSE_TARGET_TRANSITIONS
                    : 0;
                  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
                  console.log(
                    \`[collector-progress-pause] transitions=\${totalTransitions}/\${PROGRESS_PAUSE_TARGET_TRANSITIONS} reached=\${nextProgressPausePercent}% elapsed=\${formatDuration(elapsedMs)} eta_remaining=\${formatDuration(remainingMs)} pausing_ms=\${PROGRESS_PAUSE_MS}\`,
                  );
                  if (PROGRESS_PAUSE_MS > 0) {
                    await sleep(PROGRESS_PAUSE_MS);
                  }
                  nextProgressPausePercent += PROGRESS_PAUSE_PERCENT_STEP;
                }
              }

              if (done) {
                const drainStatus = await drainTerminalPhase(game, STEP_TIMEOUT_MS);
                if (drainStatus === "timeout") {
                  console.log(\`[collector-terminal-drain-timeout] episode=\${episodeId} step=\${stepIndex} phase=\${currentPhaseNameSafe(game)}\`);
                }
                if (timeoutTruncated) {
                  console.log(
                    \`[collector-timeout] episode=\${episodeId} step=\${stepIndex} phase=\${currentPhaseNameSafe(game)} ui_mode=\${currentUiModeNameSafe(game)} advance_status=\${advanceStatus} step_ms=\${stepMs} player_party="\${describePartyForDiagnostics(game)}" party_ui="\${describePartyUiHandlerForDiagnostics(game)}" prompts="\${describePromptQueueForDiagnostics(game)}"\`,
                  );
                }
                break;
              }
            }

              totalEpisodes += 1;
              globalEpisodeIndex += 1;
              console.log(\`[collector-progress] episodes=\${totalEpisodes}/\${PLANNED_EPISODES} transitions=\${totalTransitions}\`);
            } finally {
              game.phaseInterceptor.restoreOg();
            }
          }
        }
      }

      console.log(\`Collected episodes: \${totalEpisodes}\`);
      console.log(\`Collected transitions: \${totalTransitions}\`);
      const totalRuntimeMs = Date.now() - runStartedAt;
      console.log(\`Collector runtime ms: \${totalRuntimeMs}\`);
      if (PROGRESS_PAUSE_TARGET_TRANSITIONS > 0) {
        if (totalTransitions >= PROGRESS_PAUSE_TARGET_TRANSITIONS) {
          console.log(\`Collector target reached: \${PROGRESS_PAUSE_TARGET_TRANSITIONS} transitions\`);
        } else {
          console.log(\`Collector target not reached: \${totalTransitions}/\${PROGRESS_PAUSE_TARGET_TRANSITIONS} transitions\`);
        }
      }
    } finally {
      cleanupPersistentExternalPolicyWorkers();
    }
  }, TEST_TIMEOUT_MS);
});
`;

mkdirSync(tempDir, { recursive: true });
writeFileSync(tempTestPath, testSource, { encoding: "utf8" });
writeFileSync(tempHelpersPath, helperSource, { encoding: "utf8" });

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

try {
  rmSync(tempTestPath, { force: true });
  rmSync(tempHelpersPath, { force: true });
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

function materializeCollectorHelperSource(
  templateSource: string,
  terminalOnEggLapseInput: boolean,
  stepTimeoutMsInput: number,
  plannedEpisodesInput: number,
  policyInput: unknown,
): string {
  return templateSource
    .replace("__COLLECTOR_TERMINAL_ON_EGG_LAPSE__", String(terminalOnEggLapseInput))
    .replace("__COLLECTOR_STEP_TIMEOUT_MS__", String(stepTimeoutMsInput))
    .replace("__COLLECTOR_CRITICAL_HP_RATIO__", String(criticalHpRatio))
    .replace("__COLLECTOR_HALF_HP_RATIO__", String(halfHpRatio))
    .replace("__COLLECTOR_REWARD_SWITCH_PENALTY__", String(rewardSwitchPenalty))
    .replace("__COLLECTOR_REWARD_STEP_PENALTY__", String(rewardStepPenalty))
    .replace("__COLLECTOR_REWARD_CONSECUTIVE_SWITCH_PENALTY__", String(rewardConsecutiveSwitchPenalty))
    .replace("__COLLECTOR_REWARD_DIRECT_BACKSWITCH_PENALTY__", String(rewardDirectBackswitchPenalty))
    .replace("__COLLECTOR_REWARD_CONSECUTIVE_SWITCH_PENALTY_SCALE__", String(rewardConsecutiveSwitchPenaltyScale))
    .replace("__COLLECTOR_REWARD_ENEMY_TEAM_HP_DAMAGE_SCALE__", String(rewardEnemyTeamHpDamageScale))
    .replace("__COLLECTOR_REWARD_PLAYER_TEAM_HP_LOSS_SCALE__", String(rewardPlayerTeamHpLossScale))
    .replace("__COLLECTOR_REWARD_ENEMY_FAINT_BONUS__", String(rewardEnemyFaintBonus))
    .replace("__COLLECTOR_REWARD_PLAYER_FAINT_PENALTY__", String(rewardPlayerFaintPenalty))
    .replace("__COLLECTOR_REWARD_ENEMY_TEAM_DEFEAT_BONUS__", String(rewardEnemyTeamDefeatBonus))
    .replace("__COLLECTOR_REWARD_PLAYER_TEAM_DEFEAT_PENALTY__", String(rewardPlayerTeamDefeatPenalty))
    .replace("__COLLECTOR_REWARD_ALIVE_TEAM_MEMBER_WIN_BONUS__", String(rewardAliveTeamMemberWinBonus))
    .replace("__COLLECTOR_PLANNED_EPISODES__", String(plannedEpisodesInput))
    .replace("__COLLECTOR_POLICY_JSON__", escapeForTemplateString(JSON.stringify(policyInput)))
    .replace(
      "__COLLECTOR_REWARD_REMAINING_TEAM_HP_RATIO_WIN_BONUS_SCALE__",
      String(rewardRemainingTeamHpRatioWinBonusScale),
    );
}

function escapeForTemplateString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
}
