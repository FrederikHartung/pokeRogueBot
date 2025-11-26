package com.sfh.pokeRogueBot.rl.base

import com.sfh.pokeRogueBot.model.rl.RunTerminalOutcome
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Abstract base class for Reinforcement Learning neurons.
 * 
 * This class provides the common RL infrastructure that can be reused across different
 * RL domains (modifier selection, combat, etc.). Domain-specific logic is implemented
 * through abstract methods, while the RL training pipeline is handled by concrete methods.
 *
 * Key Features:
 * - Episode-based RL with terminal rewards
 * - DQN agent integration with action masking
 * - Training experience collection and logging
 * - Model loading/saving capabilities
 * - Production vs training mode support
 * - Episode lifecycle management
 *
 * @param TState The type of state representation (must implement SerializableState)
 * @param TAction The type of action (must implement SerializableAction) 
 * @param TResult The type of game result returned by decisions
 * @param TGameData The type of game data input for decisions
 */
abstract class BaseRLNeuron<TState, TAction, TResult, TGameData>(
    private val modelPath: String,
    private val loadModel: Boolean,
    private val trainingMode: Boolean
) where TState : SerializableState, TAction : SerializableAction {

    companion object {
        private val log = LoggerFactory.getLogger(BaseRLNeuron::class.java)
    }

    // Episode-based RL components
    protected val episodeManager = BaseEpisodeManager<TState, TAction>()
    protected val decisionLogger by lazy { createDecisionLogger() }

    // DQN agent - lazy initialization to allow subclass configuration
    protected val dqnAgent: BaseDQNAgent<TState, TAction> by lazy {
        val agent = createDQNAgent()

        if (loadModel) {
            // Try to load existing model
            if (File(modelPath).exists()) {
                try {
                    agent.loadModel(modelPath)
                    log.info("Loaded existing DQN model from {}", modelPath)
                } catch (e: Exception) {
                    log.warn("Failed to load DQN model from {}, using fresh model: {}", modelPath, e.message)
                }
            } else {
                log.info("No existing DQN model found at {}, starting with fresh model", modelPath)
            }
        } else {
            log.info("load model is set to false, starting with fresh model")
        }

        agent
    }

    // Abstract methods - domain-specific implementation required

    /**
     * Creates the state representation from game data.
     * @param gameData The current game data
     * @return The state representation for the RL agent
     */
    protected abstract fun createState(gameData: TGameData): TState

    /**
     * Determines all valid actions the RL agent can take given the current game state.
     * This is crucial for action masking in RL to prevent the agent from choosing invalid actions.
     *
     * @param gameData The current game data
     * @return List of valid actions the agent can choose from
     */
    protected abstract fun getAvailableActions(gameData: TGameData): List<TAction>

    /**
     * Converts the RL action to a game-executable result.
     * @param action The selected action
     * @param gameData The current game data
     * @return The game result, or null if action results in no change
     */
    protected abstract fun convertActionToResult(action: TAction, gameData: TGameData): TResult?

    /**
     * Calculates immediate reward for taking an action in a given state.
     * @param state The current state
     * @param action The selected action
     * @return The immediate reward value
     */
    protected abstract fun calculateImmediateReward(state: TState, action: TAction): Double

    /**
     * Calculates terminal reward based on run outcome.
     * This is the key reward that gets propagated back to all decisions in the run.
     *
     * @param outcome The terminal outcome of the run
     * @param waveReached The final wave reached in the run
     * @return The terminal reward value
     */
    protected abstract fun calculateTerminalReward(outcome: RunTerminalOutcome, waveReached: Int): Double

    /**
     * Creates the domain-specific DQN agent.
     * @return The configured DQN agent for this domain
     */
    protected abstract fun createDQNAgent(): BaseDQNAgent<TState, TAction>

    /**
     * Creates the domain-specific decision logger.
     * @return The configured decision logger for this domain
     */
    protected abstract fun createDecisionLogger(): BaseDecisionLogger<TState, TAction>

    /**
     * Extracts the wave index from game data for episode tracking.
     * @param gameData The current game data
     * @return The current wave index
     */
    protected abstract fun getWaveIndex(gameData: TGameData): Int

    // Concrete methods - reusable RL infrastructure

    /**
     * Main decision-making method that follows the standard RL flow:
     * 1. Create state representation
     * 2. Get available actions
     * 3. RL agent selects action
     * 4. Convert action to game result
     * 5. Log experience for training
     *
     * @param gameData The current game data
     * @return The game result to execute, or null for no action
     */
    fun makeDecision(gameData: TGameData): TResult? {
        val waveIndex = getWaveIndex(gameData)
        
        // Step 1: Create state for RL logging
        val currentState = createState(gameData)

        // Step 2: Get available actions for RL agent
        val availableActions = getAvailableActions(gameData)

        // Step 3: RL agent selects action
        val selectedAction = selectAction(currentState, availableActions)

        // Step 4: Convert RL action to game-executable result
        val result = convertActionToResult(selectedAction, gameData)

        // Step 5: Add step to current RL episode
        addStepToCurrentEpisode(selectedAction, currentState, waveIndex)

        log.info(
            "RL decision: action={}, result={}, availableActions={}",
            selectedAction, result?.toString() ?: "SKIP", availableActions
        )

        return result
    }

    /**
     * Selects an action using the trained DQN agent.
     *
     * @param state The current game state representation for RL
     * @param availableActions List of valid actions the agent can choose from
     * @return The selected action
     * @throws IllegalStateException if the DQN agent fails to make a decision
     */
    protected fun selectAction(state: TState, availableActions: List<TAction>): TAction {
        try {
            val action = dqnAgent.selectAction(state, availableActions, training = trainingMode)
            log.info("DQN selected action: {} from available: {}", action, availableActions)
            return action
        } catch (e: Exception) {
            val errorMessage = "DQN agent failed to make decision: ${e.message}. " +
                    "State: $state, Available actions: $availableActions"
            log.error(errorMessage, e)
            throw IllegalStateException(errorMessage, e)
        }
    }

    /**
     * Adds a decision step to the current RL episode.
     * Each step will receive rewards when the episode terminates.
     */
    private fun addStepToCurrentEpisode(action: TAction, state: TState, waveIndex: Int) {
        val currentEpisode = episodeManager.getCurrentEpisode()
        if (currentEpisode == null) {
            // No current episode - start a new one and check if it's a resumed run
            val isResumedRun = waveIndex > 1
            episodeManager.startNewEpisode(isResumedRun)

            if (isResumedRun) {
                log.warn("Started new RL episode for RESUMED run at wave {} - Training data will be marked as invalid", waveIndex)
            } else {
                log.info("Started new RL episode at wave {}", waveIndex)
            }
        }

        val reward = calculateImmediateReward(state, action)

        val step = BaseRLStep(
            state = state,
            action = action,
            immediateReward = reward,
            nextState = null, // Will be updated if there are multiple steps
            waveNumber = waveIndex,
            isTerminal = false,
            terminalReward = 0.0
        )

        episodeManager.addStepToCurrentEpisode(step)
        log.info("Added RL step to episode: wave={}, action={}", waveIndex, action)
    }

    /**
     * Adds training experience to the DQN agent (when in training mode).
     */
    fun addTrainingExperience(experience: BaseExperience<TState, TAction>) {
        if (trainingMode) {
            dqnAgent.addExperience(experience)
            dqnAgent.trainStep()
        }
    }

    /**
     * Saves the current DQN model to disk.
     */
    fun saveModel() {
        try {
            // Ensure models directory exists
            File(modelPath).parentFile?.mkdirs()
            dqnAgent.saveModel(modelPath)
            log.info("DQN model saved successfully to {}", modelPath)
        } catch (e: Exception) {
            log.error("Failed to save DQN model to {}", modelPath, e)
        }
    }

    /**
     * Gets DQN agent statistics for monitoring.
     */
    fun getDQNStats(): Map<String, Any> {
        return dqnAgent.getTrainingStats()
    }

    /**
     * Completes the current RL episode when a run ends.
     * This triggers terminal reward calculation and episode logging.
     */
    fun completeCurrentEpisode(outcome: RunTerminalOutcome, waveReached: Int) {
        episodeManager.getCurrentEpisode()?.let { episode ->
            val terminalRewardCalculator = { o: RunTerminalOutcome, w: Int -> calculateTerminalReward(o, w) }
            episodeManager.completeCurrentEpisode(outcome, waveReached, terminalRewardCalculator)

            if (episode.isValidForTraining) {
                // Only log experiences for valid episodes (not resumed runs)
                val allExperiences = episode.getAllExperiences()
                allExperiences.forEach { experience ->
                    decisionLogger.logDecision(
                        experience.state,
                        experience.action,
                        experience.reward,
                        experience.nextState,
                        experience.done
                    )
                }

                log.info(
                    "Completed VALID RL episode: outcome={}, waveReached={}, steps={}, finalReward={}",
                    outcome, waveReached, episode.getStepCount(), episode.finalReward
                )

                // Save training data after each completed episode and clear buffer
                val bufferStats = decisionLogger.getBufferStats()
                val bufferSize = bufferStats["bufferSize"] as Int
                log.info(
                    "Saving training data: {} experiences from episode {}",
                    bufferSize, episodeManager.getEpisodeCount()
                )
                decisionLogger.saveAndClearBuffer()
            } else {
                log.warn(
                    "Completed INVALID RL episode (resumed run): outcome={}, waveReached={}, steps={} - EXCLUDED from training",
                    outcome, waveReached, episode.getStepCount()
                )
            }
        }
    }

    /**
     * Starts a new RL episode when a new run begins.
     * Called when the run property is created or reset.
     *
     * @param isResumedRun true if this run is resumed from a save game (waveIndex > 1)
     */
    fun startNewRLEpisode(isResumedRun: Boolean = false) {
        val newEpisode = episodeManager.startNewEpisode(isResumedRun)
        if (isResumedRun) {
            log.warn("Started new RL episode for RESUMED run: runId={} - Training data will be marked as invalid", newEpisode.runId)
        } else {
            log.info("Started new RL episode: runId={}", newEpisode.runId)
        }
    }

    /**
     * Completes the current episode with victory outcome.
     * Should be called when a run is successfully completed.
     */
    fun onRunCompleted(waveReached: Int) {
        completeCurrentEpisode(RunTerminalOutcome.VICTORY, waveReached)
    }

    /**
     * Discards the current episode without persisting it.
     * Used when a run is terminated due to errors or user interruption.
     */
    fun discardCurrentEpisode() {
        episodeManager.getCurrentEpisode()?.let {
            episodeManager.discardCurrentEpisode()
            log.info("Discarded RL episode due to error/interruption. Episode had ${it.getStepCount()} steps.")
        }
    }

    /**
     * Discards the current episode due to error.
     * Should be called when technical errors terminate the run.
     * Episodes with errors are discarded and not used for training.
     */
    fun onRunError(waveReached: Int) {
        discardCurrentEpisode()
    }

    /**
     * Get statistics about collected RL episodes and training data.
     */
    fun getTrainingDataStats(): String {
        val loggerStats = decisionLogger.getBufferStats()
        val episodeCount = episodeManager.getEpisodeCount()
        val currentEpisode = episodeManager.getCurrentEpisode()
        val currentSteps = currentEpisode?.getStepCount() ?: 0

        return "Episodes completed: $episodeCount, Current episode steps: $currentSteps, " +
                "Buffered experiences: ${loggerStats["bufferSize"]}, " +
                "Average reward: ${loggerStats["averageReward"]}"
    }
}