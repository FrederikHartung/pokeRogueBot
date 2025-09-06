package com.sfh.pokeRogueBot.model.rl

/**
 * Represents a single RL episode that spans an entire PokeRogue run.
 *
 * RL Episode Design:
 * - Episode = Entire run from start to team wipe/victory
 * - Step = Individual modifier selection decision within the run
 * - Terminal state = Team wipe or run completion
 *
 * This approach enables long-term learning:
 * - Bad early decisions → team wipe later → negative terminal reward propagated back
 * - Good consistent decisions → long successful run → positive rewards
 * - Credit assignment across multiple modifier selections
 *
 * Episode Flow:
 * Start → [Step 1: State, Action, Reward] → [Step 2: State, Action, Reward] → ... → Terminal
 */
data class ModifierRLEpisode(
    val runId: String,
    val steps: MutableList<ModifierRLStep> = mutableListOf(),
    var isComplete: Boolean = false,
    var terminalOutcome: RunTerminalOutcome? = null,
    var finalReward: Double = 0.0,
    var waveReached: Int = 0,
    var startTimestamp: Long = System.currentTimeMillis()
) {

    /**
     * Adds a new step to the episode.
     * @param step The modifier decision step to add
     */
    fun addStep(step: ModifierRLStep) {
        if (isComplete) {
            throw IllegalStateException("Cannot add step to completed episode")
        }
        steps.add(step)
    }

    /**
     * Completes the episode with terminal outcome and calculates final rewards.
     * @param outcome The terminal outcome (team wipe, victory, etc.)
     * @param waveReached The final wave reached in the run
     */
    fun complete(outcome: RunTerminalOutcome, waveReached: Int) {
        this.terminalOutcome = outcome
        this.waveReached = waveReached
        this.isComplete = true

        // Calculate terminal reward based on run outcome
        this.finalReward = calculateTerminalReward(outcome, waveReached)

        // Update the last step with terminal information
        if (steps.isNotEmpty()) {
            val lastStep = steps.last()
            steps[steps.size - 1] = lastStep.copy(
                isTerminal = true,
                terminalReward = finalReward
            )
        }
    }

    /**
     * Calculates terminal reward based on run outcome.
     * This is the key reward that gets propagated back to all decisions in the run.
     */
    private fun calculateTerminalReward(outcome: RunTerminalOutcome, waveReached: Int): Double {
        return when (outcome) {
            RunTerminalOutcome.TEAM_WIPE -> {
                // Negative reward scaled by how early the wipe occurred
                -50.0 + (waveReached * 0.5) // Less penalty for later wipes
            }

            RunTerminalOutcome.VICTORY -> {
                100.0 + (waveReached * 2.0) // Big bonus for victory, more for longer runs
            }

            RunTerminalOutcome.RUN_ABANDONED -> {
                -10.0 // Small penalty for abandoned runs
            }

            RunTerminalOutcome.ERROR_OCCURRED -> {
                0.0 // Neutral for technical errors
            }
        }
    }

    /**
     * Gets all experiences for training, with proper terminal rewards applied.
     */
    fun getAllExperiences(): List<Experience> {
        return steps.map { step ->
            val totalReward = step.immediateReward +
                    if (step.isTerminal) step.terminalReward else 0.0

            Experience(
                state = step.state,
                action = step.action,
                reward = totalReward,
                nextState = step.nextState,
                done = step.isTerminal,
                timestamp = step.timestamp
            )
        }
    }

    fun getStepCount(): Int = steps.size
    fun getDuration(): Long = System.currentTimeMillis() - startTimestamp
}

/**
 * Represents a single step (modifier decision) within an RL episode.
 */
data class ModifierRLStep(
    val state: SmallModifierSelectState,
    val action: ModifierAction,
    val immediateReward: Double,
    val nextState: SmallModifierSelectState? = null,
    val waveNumber: Int,
    val isTerminal: Boolean = false,
    val terminalReward: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Possible terminal outcomes for a PokeRogue run.
 */
enum class RunTerminalOutcome {
    TEAM_WIPE,      // All Pokemon fainted
    VICTORY,        // Successfully completed the run
    RUN_ABANDONED,  // Player manually ended the run
    ERROR_OCCURRED  // Technical error terminated the run
}

/**
 * Manages the collection of episodes for training.
 */
class ModifierEpisodeManager {
    private val episodes = mutableListOf<ModifierRLEpisode>()
    private var currentEpisode: ModifierRLEpisode? = null

    /**
     * Starts a new episode (new run).
     */
    fun startNewEpisode(): ModifierRLEpisode {
        val runId = generateRunId()
        currentEpisode = ModifierRLEpisode(runId = runId)
        return currentEpisode!!
    }

    /**
     * Adds a step to the current episode.
     */
    fun addStepToCurrentEpisode(step: ModifierRLStep) {
        currentEpisode?.addStep(step)
            ?: throw IllegalStateException("No active episode to add step to")
    }

    /**
     * Completes the current episode.
     */
    fun completeCurrentEpisode(outcome: RunTerminalOutcome, waveReached: Int) {
        val episode = currentEpisode
            ?: throw IllegalStateException("No active episode to complete")

        episode.complete(outcome, waveReached)
        episodes.add(episode)
        currentEpisode = null
    }

    /**
     * Gets all completed episodes for training.
     */
    fun getCompletedEpisodes(): List<ModifierRLEpisode> {
        return episodes.filter { it.isComplete }
    }

    /**
     * Gets all training experiences from completed episodes.
     */
    fun getAllTrainingExperiences(): List<Experience> {
        return getCompletedEpisodes().flatMap { it.getAllExperiences() }
    }

    /**
     * Clears old episodes to manage memory.
     */
    fun clearOldEpisodes(keepLastN: Int = 1000) {
        if (episodes.size > keepLastN) {
            episodes.subList(0, episodes.size - keepLastN).clear()
        }
    }

    fun getCurrentEpisode(): ModifierRLEpisode? = currentEpisode
    fun getEpisodeCount(): Int = episodes.size

    private fun generateRunId(): String {
        return "run_${System.currentTimeMillis()}_${(0..999).random()}"
    }
}