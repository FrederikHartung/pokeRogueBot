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
import { linkCombatObservationModule } from "./combat-observation-module.ts";

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
// Wildkaempfe ab Wave 2 im Kampfstil SWITCH spielen, damit das Wechselangebot (decision_kind 2) in den Daten vorkommt.
const checkSwitchDecisions = config.check_switch_decisions !== false;
const criticalHpRatio = 0.1;
const halfHpRatio = 0.5;
// POKEROGUE_COMBAT_STEP_TIMEOUT_MS wie beim Modifier-Collector (POKEROGUE_MODIFIER_STEP_TIMEOUT_MS), z. B. um in
// Tests gezielt Timeouts zu erzwingen; die Random-Policy hat kein eigenes step_timeout_ms.
const envStepTimeoutMs = Number.parseInt(process.env.POKEROGUE_COMBAT_STEP_TIMEOUT_MS ?? "", 10);
const stepTimeoutMs = Number.isInteger(envStepTimeoutMs) && envStepTimeoutMs > 0
  ? envStepTimeoutMs
  : Number.isFinite(policy.step_timeout_ms) && policy.step_timeout_ms > 0
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
// Technisch beendete Episoden (Timeout, Exception) landen nicht im Datensatz, sondern als JSONL hier;
// die Zusammenfassung (geplant/regulaer/technisch) liest die Pipeline nach dem Lauf.
const technicalFailuresPath = `${outputPath}.technical-failures.jsonl`;
const collectorSummaryPath = `${outputPath}.summary.json`;
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
if (!appendOutput && existsSync(technicalFailuresPath)) {
  unlinkSync(technicalFailuresPath);
}
rmSync(collectorSummaryPath, { force: true });

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
import { GameManager } from "#test/framework/game-manager";
import { PromptHandler } from "#test/helpers/prompt-handler";
import { installSingleDriverPhaseInterceptor } from "#test/porubot/harness/single-driver-phase-interceptor";
import { resolveLearnMoveIfNeeded } from "#test/porubot/harness/battle-command-advance";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import {
  applyScenarioMaterializedState,
  applyScenarioOverrides,
  applyStateVariant,
  buildBattleContext,
  buildObservation,
  canBuildCombatObservation,
  cleanupPersistentExternalPolicyWorkers,
  computeTransitionReward,
  countAlivePlayerTeamMembers,
  countFaintedEnemyPokemon,
  countFaintedPlayerPokemon,
  currentPhaseNameSafe,
  currentUiModeNameSafe,
  deriveTerminalNextState,
  deriveTerminalOutcome,
  describePartyForDiagnostics,
  describePartyUiHandlerForDiagnostics,
  describePromptQueueForDiagnostics,
  drainTerminalPhase,
  emptyCombatDecisionHistory,
  executeAction,
  findActivePartySlotIndex,
  getEnemyTeamHpRatio,
  getPlayerTeamHpRatio,
  hasLoggedTerminalPhaseSince,
  hasRemainingPlayerTeam,
  isCollectorEpisodeTerminalPhase,
  isVictorySafe,
  leavePartyOptionsOpenForTest,
  resolveForcedSwitchIfNeeded,
  resolveOptionalCheckSwitchIfNeeded,
  selectActionFromMask,
  setSwitchDecisionProvider,
  sleep,
  startScenarioBattle,
  updateCombatDecisionHistory,
  waitForCommandOrTerminalAfterForcedSwitch,
  waitForPromiseOrTerminal,
  withTimeout,
} from "./experience-collector.helpers";

const SCENARIOS = ${JSON.stringify(scenarios)};
const SEEDS = ${JSON.stringify(seeds)};
const EPISODES_PER_SEED = ${episodesPerSeed};
const MAX_STEPS_PER_EPISODE = ${maxStepsPerEpisode};
const POLICY = ${JSON.stringify(policy)};
const OUTPUT_PATH = ${JSON.stringify(outputPath)};
const TECHNICAL_FAILURES_PATH = ${JSON.stringify(technicalFailuresPath)};
const SUMMARY_PATH = ${JSON.stringify(collectorSummaryPath)};
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
const CHECK_SWITCH_DECISIONS = ${checkSwitchDecisions};
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

function safeDiagnostic<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function buildEpisodeDebugSnapshot(game: GameManager, stepIndex: number): Record<string, unknown> {
  return {
    step_index: stepIndex,
    phase: safeDiagnostic(() => currentPhaseNameSafe(game), "unknown"),
    ui_mode: safeDiagnostic(() => currentUiModeNameSafe(game), "unknown"),
    wave: safeDiagnostic(() => currentWaveIndexSafe(game, -1), -1),
    is_double_battle: safeDiagnostic(() => game.scene.currentBattle?.double ?? null, null),
    player_active_trapped: safeDiagnostic(() => game.scene.getPlayerPokemon()?.isTrapped() ?? null, null),
    player_party: safeDiagnostic(() => describePartyForDiagnostics(game), "unknown"),
    party_ui: safeDiagnostic(() => describePartyUiHandlerForDiagnostics(game), "unknown"),
    prompts: safeDiagnostic(() => describePromptQueueForDiagnostics(game), "unknown"),
  };
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
    if (resolveLearnMoveIfNeeded(game)) {
      console.log(\`[collector-learn-move] ui_mode=\${currentUiModeNameSafe(game)}\`);
    }
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
    let technicalEpisodes = 0;
    const episodeOutcomes: Array<"regular" | "technical"> = [];
    let globalEpisodeIndex = EPISODE_INDEX_OFFSET;
    let nextProgressPausePercent = PROGRESS_PAUSE_PERCENT_STEP;

    try {
      for (const scenario of SCENARIOS) {
        for (const seedOverride of SEEDS) {
          for (let episodeIndex = 0; episodeIndex < EPISODES_PER_SEED; episodeIndex += 1) {
            // Seit v1.12 geht der Harness von einem GameManager pro Test aus. Der Collector legt pro Episode
            // einen neuen an (auf derselben globalen Szene) und muss deshalb selbst aufraeumen, was sonst
            // zwischen zwei Tests passiert: das statische PromptHandler-Intervall (afterEach-Hook in
            // test/setup/vitest.setup.ts) und die Spies auf Szene/UI (restoreMocks: true in vitest.config.ts).
            // Ohne das wirft die zweite Episode bzw. die Spies verschachteln sich (Stack Overflow).
            clearInterval(PromptHandler.runInterval);
            PromptHandler.runInterval = undefined;
            vi.restoreAllMocks();
            const game = new GameManager(phaserGame);
            // advanceAfterAction laesst toEndOfTurn()/toNextTurn()-Aufrufe unerledigt zurueck; ohne Schutz treiben
            // mehrere to()-Aufrufe Phasen parallel (siehe docs/pokerogue-headless-test-harness-mechanics.md, 3.11).
            installSingleDriverPhaseInterceptor(game);
            const episodeId = \`\${scenario.__scenario_name}::\${seedOverride ?? scenario.seed ?? "seedless"}::\${globalEpisodeIndex}\`;
            const effectiveSeed = seedOverride ?? scenario.seed ?? "seedless";
            // Transitions werden erst am Episodenende geschrieben: eine technisch beendete Episode
            // (Timeout, Exception) landet so nicht halb im Datensatz.
            const episodeRecords: string[] = [];
            let technicalFailure: Record<string, unknown> | null = null;
            let lastStepIndex = -1;
            const battleMessageCursor = { index: 0 };
            try {
            applyScenarioOverrides(game, scenario, seedOverride, { checkSwitchDecisions: CHECK_SWITCH_DECISIONS });

            // Szenario-Zustand (HP, Moves, Status) und State-Variante genau einmal anwenden: beim Wechselangebot zu
            // Kampfbeginn schon vor der ersten Entscheidung, sonst direkt nach dem Kampfstart. Ein zweites Anwenden
            // nach einem Wechsel wuerde wegen des Positionstauschs die falschen Pokemon patchen.
            const episodeStateVariant = selectEpisodeStateVariant(globalEpisodeIndex);
            let materialized = false;
            const materializeScenarioOnce = () => {
              if (materialized) {
                return;
              }
              materialized = true;
              applyScenarioMaterializedState(game, scenario);
              applyStateVariant(game, episodeStateVariant, episodeId);
            };

            // Jede Entscheidung (command, forced_switch, check_switch) ist eine Transition. Sie bleibt offen, bis die
            // naechste Entscheidung oder das Episodenende ihren next_state liefert; der Reward deckt genau dieses
            // Fenster ab (Team-HP und K.O.-Zaehler beim Oeffnen gegen den Stand beim Schliessen).
            let history = emptyCombatDecisionHistory();
            let pending: any = null;
            let decisionCount = 0;
            // Die Episode ist genau ein Kampf. Flieht der Gegner (z. B. Teleport), laeuft das Spiel in den naechsten Kampf
            // weiter; ab dann entscheidet weder die Episode noch der Wechsel-Hook mehr.
            const episodeWaveIndex = Number(scenario.wave_index);
            let episodeEnded = false;

            const finalizePending = (nextState: any, done: boolean, flags: Record<string, boolean> = {}) => {
              const decision = pending;
              if (!decision) {
                return;
              }
              pending = null;
              const enemyTeamDefeated = flags.enemyTeamDefeated === true;
              const playerTeamDefeated = flags.playerTeamDefeated === true;
              const nextPlayerTeamHp = playerTeamDefeated ? 0 : getPlayerTeamHpRatio(game);
              const nextEnemyTeamHp = enemyTeamDefeated ? 0 : getEnemyTeamHpRatio(game);
              const reward = computeTransitionReward({
                decisionKind: decision.decisionKind,
                action: decision.action,
                activePartyIndexBeforeAction: decision.activePartyIndex,
                lastActionWasSwitch: decision.historyBefore.lastActionWasSwitch,
                consecutiveSwitchCount: decision.historyBefore.consecutiveSwitchCount,
                lastSwitchOriginPartyIndex: decision.historyBefore.lastSwitchOriginPartyIndex,
                enemyTeamHpBeforeAction: decision.window.enemyTeamHp,
                nextEnemyTeamHp,
                playerTeamHpBeforeAction: decision.window.playerTeamHp,
                nextPlayerTeamHp,
                enemyFaints: countFaintedEnemyPokemon(game) - decision.window.enemyFainted,
                playerFaints: countFaintedPlayerPokemon(game) - decision.window.playerFainted,
                enemyTeamDefeated,
                playerTeamDefeated,
                alivePlayerTeamMembers: countAlivePlayerTeamMembers(game),
              });
              const outcome = done
                ? deriveTerminalOutcome({
                  enemyTeamDefeated,
                  playerTeamDefeated,
                  timeoutTruncated: flags.timeoutTruncated === true,
                  maxStepsTruncated: flags.maxStepsTruncated === true,
                  battleEnded: flags.battleEnded === true,
                })
                : null;
              episodeRecords.push(JSON.stringify({
                episode_id: episodeId,
                step_index: decision.stepIndex,
                state: decision.state,
                action: decision.action,
                reward,
                next_state: nextState,
                done,
                meta: {
                  seed: effectiveSeed,
                  wave: currentWaveIndexSafe(game, decision.state.wave_index),
                  battle_type: "single",
                  state_schema_version: "combat-v4",
                  scenario: scenario.__scenario_name,
                  state_variant: episodeStateVariant,
                  action_source: decision.actionSource,
                  outcome,
                },
                timestamp: Date.now(),
              }));
            };

            const decide = async (decisionKind: number, state: any) => {
              const policyExtras: Record<string, unknown> = {
                episode_id: episodeId,
                step_index: decisionCount,
                decision_kind: decisionKind,
              };
              if (POLICY.include_battle_context === true) {
                policyExtras.battle_context = buildBattleContext(game, battleMessageCursor);
              }
              return selectActionFromMask(state, state.action_mask, globalEpisodeIndex, policyExtras);
            };

            const openDecision = (state: any, decisionKind: number, action: number, actionSource: string) => {
              const activePartyIndex = findActivePartySlotIndex(state);
              pending = {
                state,
                decisionKind,
                action,
                actionSource,
                activePartyIndex,
                stepIndex: decisionCount,
                historyBefore: history,
                window: {
                  playerTeamHp: getPlayerTeamHpRatio(game),
                  enemyTeamHp: getEnemyTeamHpRatio(game),
                  playerFainted: countFaintedPlayerPokemon(game),
                  enemyFainted: countFaintedEnemyPokemon(game),
                },
              };
              history = updateCombatDecisionHistory(history, decisionKind, action, activePartyIndex);
              decisionCount += 1;
            };

            // Zwangswechsel und Wechselangebot entscheidet dieselbe Policy (Harness-Hook, switch-decision.ts).
            // null = Harness-Standard (erster gueltiger Slot bzw. ablehnen), z. B. nach dem Sieg oder ohne Gegner.
            setSwitchDecisionProvider(game, async (_game, kind) => {
              if (
                episodeEnded
                || decisionCount >= MAX_STEPS_PER_EPISODE
                || game.scene.currentBattle?.double
                || game.scene.currentBattle?.waveIndex !== episodeWaveIndex
              ) {
                return null;
              }
              if (kind === "check_switch") {
                materializeScenarioOnce();
              }
              if (!canBuildCombatObservation(game.scene) || isVictorySafe(game) || !hasRemainingPlayerTeam(game)) {
                return null;
              }
              const decisionKind = kind === "forced_switch" ? 1 : 2;
              const state = buildObservation(game, scenario, history, decisionKind);
              if (!state.action_mask.some((value: number) => value === 1)) {
                return null;
              }
              finalizePending(state, false);
              const { action, actionSource } = await decide(decisionKind, state);
              if (action < MOVE_ACTIONS) {
                return null;
              }
              openDecision(state, decisionKind, action, actionSource);
              const slot = action - MOVE_ACTIONS;
              return decisionKind === 2 && state.party_slots[slot]?.active === 1 ? "stay" : slot;
            });

            const teamSpecies = scenario.player_team.map(member => member.species_id);
            await startScenarioBattle(game, scenario, teamSpecies);
            materializeScenarioOnce();
            // Kampfmeldungen fuer kontextbasierte Policies erst ab hier: die Intro-Meldungen nennen den vom Spiel
            // gewuerfelten Gegner, bevor der Collector ihn durch den Szenario-Gegner ersetzt.
            battleMessageCursor.index = Array.isArray(game.textInterceptor?.logs) ? game.textInterceptor.logs.length : 0;

            // Nur fuer den Replay-Test (Signatur E): hinterlaesst ein offenes Options-Menue im Party-Handler, wie es
            // ein frueherer Kampf auf derselben Szene tun kann.
            if (process.env.POKEROGUE_COLLECTOR_TEST_STALE_PARTY_OPTIONS === "1") {
              const leftOpen = await leavePartyOptionsOpenForTest(game);
              console.log(\`[collector-test-hook] stale_party_options=\${leftOpen}\`);
            }

            while (true) {
              lastStepIndex = decisionCount;
              const state = buildObservation(game, scenario, history, 0);
              if (decisionCount >= MAX_STEPS_PER_EPISODE) {
                finalizePending(state, true, { maxStepsTruncated: true });
                break;
              }
              finalizePending(state, false);
              const { action, actionSource } = await decide(0, state);
              if (action < 0) {
                break;
              }
              openDecision(state, 0, action, actionSource);

              const stepStartAt = Date.now();
              executeAction(game, action);
              const advanceStatus = await advanceAfterAction(game);
              const stepMs = Date.now() - stepStartAt;

              const battleChanged = game.scene.currentBattle?.waveIndex !== episodeWaveIndex;
              const enemyTeamDefeated = !battleChanged && isVictorySafe(game);
              const playerTeamDefeated = !hasRemainingPlayerTeam(game);
              const hardTerminalPhase = isCollectorEpisodeTerminalPhase(game);
              const timeoutTruncated = advanceStatus === "timeout";
              // "terminal" ohne Sieg/Niederlage: Kampf ohne Ergebnis beendet (Flucht). toNextTurn() laeuft seit v1.12 bis
              // in den naechsten Kampf weiter; frueher spielte die Episode diesen dann faelschlich mit.
              const battleEnded = advanceStatus === "terminal" || battleChanged;
              const done = enemyTeamDefeated || playerTeamDefeated || hardTerminalPhase || timeoutTruncated || battleEnded;

              if (done) {
                episodeEnded = true;
                const lastDecision = pending;
                if (lastDecision) {
                  finalizePending(
                    deriveTerminalNextState(lastDecision.state, enemyTeamDefeated, playerTeamDefeated),
                    true,
                    { enemyTeamDefeated, playerTeamDefeated, timeoutTruncated, battleEnded },
                  );
                }
                const drainStatus = await drainTerminalPhase(game, STEP_TIMEOUT_MS);
                if (drainStatus === "timeout") {
                  console.log(\`[collector-terminal-drain-timeout] episode=\${episodeId} step=\${lastStepIndex} phase=\${currentPhaseNameSafe(game)}\`);
                }
                if (timeoutTruncated) {
                  console.log(
                    \`[collector-timeout] episode=\${episodeId} step=\${lastStepIndex} phase=\${currentPhaseNameSafe(game)} ui_mode=\${currentUiModeNameSafe(game)} advance_status=\${advanceStatus} step_ms=\${stepMs} player_party="\${describePartyForDiagnostics(game)}" party_ui="\${describePartyUiHandlerForDiagnostics(game)}" prompts="\${describePromptQueueForDiagnostics(game)}"\`,
                  );
                  technicalFailure = {
                    kind: "collector_episode_timeout",
                    reason: \`advance_timeout:\${currentPhaseNameSafe(game)}\`,
                    ...buildEpisodeDebugSnapshot(game, lastStepIndex),
                    advance_status: advanceStatus,
                    step_ms: stepMs,
                    action: lastDecision?.action ?? action,
                    action_kind: (lastDecision?.action ?? action) >= MOVE_ACTIONS ? "switch" : "move",
                    decision_kind: lastDecision?.decisionKind ?? 0,
                    action_mask: lastDecision?.state?.action_mask ?? state.action_mask,
                  };
                }
                break;
              }

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
            }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              console.log(\`[collector-episode-error] episode=\${episodeId} step=\${lastStepIndex} phase=\${currentPhaseNameSafe(game)} error=\${message}\`);
              technicalFailure = {
                kind: "collector_episode_error",
                reason: \`exception:\${(message.split("\\n")[0] ?? "").slice(0, 200)}\`,
                ...buildEpisodeDebugSnapshot(game, lastStepIndex),
                error_message: message,
                error_stack: error instanceof Error ? error.stack ?? null : null,
              };
            }

              if (technicalFailure) {
                technicalEpisodes += 1;
                episodeOutcomes.push("technical");
                fs.mkdirSync(path.dirname(TECHNICAL_FAILURES_PATH), { recursive: true });
                fs.appendFileSync(TECHNICAL_FAILURES_PATH, \`\${JSON.stringify({
                  episode_id: episodeId,
                  scenario: scenario.__scenario_name,
                  scenario_path: scenario.__scenario_source_path,
                  seed: effectiveSeed,
                  seed_override: seedOverride,
                  global_episode_index: globalEpisodeIndex,
                  wave_index: scenario.wave_index ?? null,
                  dropped_transitions: episodeRecords.length,
                  ...technicalFailure,
                })}\\n\`, { encoding: "utf8" });
              } else {
                episodeOutcomes.push("regular");
                if (episodeRecords.length > 0) {
                  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
                  fs.appendFileSync(OUTPUT_PATH, \`\${episodeRecords.join("\\n")}\\n\`, { encoding: "utf8" });
                }
                totalTransitions += episodeRecords.length;
                totalEpisodes += 1;
              }
              globalEpisodeIndex += 1;
              console.log(\`[collector-progress] episodes=\${totalEpisodes + technicalEpisodes}/\${PLANNED_EPISODES} regular=\${totalEpisodes} technical=\${technicalEpisodes} transitions=\${totalTransitions}\`);
          }
        }
      }

      console.log(\`Collected episodes: \${totalEpisodes}\`);
      console.log(\`Technical episodes: \${technicalEpisodes}\`);
      fs.writeFileSync(SUMMARY_PATH, JSON.stringify({
        planned_episodes: PLANNED_EPISODES,
        regular_episodes: totalEpisodes,
        technical_episodes: technicalEpisodes,
        transitions: totalTransitions,
        episode_outcomes: episodeOutcomes,
      }, null, 2), { encoding: "utf8" });
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
// Gemeinsamer combat-v4-Builder (auch JS-Bridge und strategischer Collector) wird neben den Helper kopiert.
writeFileSync(tempHelpersPath, linkCombatObservationModule(helperSource, tempDir, repoRoot), { encoding: "utf8" });

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

// Fehlt die Zusammenfassung, ist der Vitest-Prozess vor dem Ende der Episodenschleife abgebrochen
// (Test-Timeout, Absturz). Die nicht gelaufenen Episoden werden als ein technischer Fehler erfasst,
// statt still zu fehlen. Ein Exit != 0 trotz Zusammenfassung (z. B. unbehandelte Rejections) ebenso.
const collectorSummary = existsSync(collectorSummaryPath)
  ? JSON.parse(readFileSync(collectorSummaryPath, "utf8"))
  : null;
if (collectorSummary == null || result.status !== 0) {
  const recordedEpisodes = collectorSummary
    ? Number(collectorSummary.regular_episodes) + Number(collectorSummary.technical_episodes)
    : countRecordedEpisodes(outputPath) + countLines(technicalFailuresPath);
  const failure = {
    episode_id: `collector-process::${path.basename(outputPath)}`,
    scenario: scenarios.length === 1 ? scenarios[0].__scenario_name : null,
    scenario_path: scenarios.length === 1 ? scenarios[0].__scenario_source_path : null,
    seed: seeds.length === 1 ? seeds[0] ?? scenarios[0]?.seed ?? null : null,
    seed_override: seeds.length === 1 ? seeds[0] : null,
    global_episode_index: episodeIndexOffset + recordedEpisodes,
    wave_index: scenarios.length === 1 ? scenarios[0].wave_index ?? null : null,
    kind: "collector_process_failed",
    reason: collectorSummary == null
      ? `vitest_aborted_before_summary:exit_${result.status ?? "none"}${result.signal ? `:${result.signal}` : ""}`
      : `vitest_exit_${result.status ?? "none"}_after_summary`,
    missing_episodes: Math.max(0, plannedEpisodes - recordedEpisodes),
    exit_code: result.status ?? null,
    signal: result.signal ?? null,
  };
  mkdirSync(path.dirname(technicalFailuresPath), { recursive: true });
  writeFileSync(technicalFailuresPath, `${JSON.stringify(failure)}\n`, { encoding: "utf8", flag: "a" });
  console.log(`[collector-process-failed] reason=${failure.reason} missing_episodes=${failure.missing_episodes}`);
  if (collectorSummary == null) {
    writeFileSync(collectorSummaryPath, JSON.stringify({
      planned_episodes: plannedEpisodes,
      regular_episodes: countRecordedEpisodes(outputPath),
      technical_episodes: countLines(technicalFailuresPath),
      transitions: countLines(outputPath),
      episode_outcomes: null,
      process_failed: true,
    }, null, 2), { encoding: "utf8" });
  }
}

console.log("Collector output:", outputPath);
console.log("Transition lines:", countLines(outputPath));
console.log("Technical failures:", technicalFailuresPath, countLines(technicalFailuresPath));

function countLines(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }
  return readFileSync(filePath, "utf8").split("\n").filter(Boolean).length;
}

function countRecordedEpisodes(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }
  const episodeIds = new Set<string>();
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    if (line) {
      episodeIds.add(String(JSON.parse(line).episode_id));
    }
  }
  return episodeIds.size;
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
