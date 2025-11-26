package com.sfh.pokeRogueBot.rl.base

import com.sfh.pokeRogueBot.model.rl.RunTerminalOutcome

/**
 * Manages the collection of episodes for training.
 * Generic implementation that can be used for any RL domain.
 *
 * @param TState The type of state representation (e.g., SmallModifierSelectState, CombatState)
 * @param TAction The type of action (e.g., ModifierAction, CombatAction)
 */
class BaseEpisodeManager<TState, TAction> {
    private val episodes = mutableListOf<BaseRLEpisode<TState, TAction>>()
    private var currentEpisode: BaseRLEpisode<TState, TAction>? = null

    /**
     * Starts a new episode (new run).
     *
     * @param isResumedRun true if this episode is from a resumed run (waveIndex > 1)
     */
    fun startNewEpisode(isResumedRun: Boolean = false): BaseRLEpisode<TState, TAction> {
        val runId = generateRunId()
        currentEpisode = BaseRLEpisode(
            runId = runId,
            isValidForTraining = !isResumedRun  // Invalid if resumed
        )
        return currentEpisode!!
    }

    /**
     * Adds a step to the current episode.
     */
    fun addStepToCurrentEpisode(step: BaseRLStep<TState, TAction>) {
        currentEpisode?.addStep(step)
            ?: throw IllegalStateException("No active episode to add step to")
    }

    /**
     * Completes the current episode.
     * @param outcome The terminal outcome
     * @param waveReached The final wave reached
     * @param terminalRewardCalculator Function to calculate terminal reward
     */
    fun completeCurrentEpisode(
        outcome: RunTerminalOutcome, 
        waveReached: Int,
        terminalRewardCalculator: (RunTerminalOutcome, Int) -> Double
    ) {
        val episode = currentEpisode
            ?: throw IllegalStateException("No active episode to complete")

        episode.complete(outcome, waveReached, terminalRewardCalculator)
        episodes.add(episode)
        currentEpisode = null
    }

    /**
     * Discards the current episode without persisting it.
     * Used when a run is terminated due to errors or user interruption.
     */
    fun discardCurrentEpisode() {
        val episode = currentEpisode
            ?: throw IllegalStateException("No active episode to discard")
        
        currentEpisode = null
    }

    /**
     * Gets all completed episodes for training.
     */
    fun getCompletedEpisodes(): List<BaseRLEpisode<TState, TAction>> {
        return episodes.filter { it.isComplete }
    }

    /**
     * Gets all valid completed episodes for training (excludes resumed runs).
     */
    fun getValidCompletedEpisodes(): List<BaseRLEpisode<TState, TAction>> {
        return episodes.filter { it.isComplete && it.isValidForTraining }
    }

    /**
     * Gets all training experiences from valid completed episodes only.
     * Excludes experiences from resumed runs to prevent corrupted training data.
     */
    fun getAllTrainingExperiences(): List<BaseExperience<TState, TAction>> {
        return getValidCompletedEpisodes().flatMap { it.getAllExperiences() }
    }

    /**
     * Clears old episodes to manage memory.
     */
    fun clearOldEpisodes(keepLastN: Int = 1000) {
        if (episodes.size > keepLastN) {
            episodes.subList(0, episodes.size - keepLastN).clear()
        }
    }

    fun getCurrentEpisode(): BaseRLEpisode<TState, TAction>? = currentEpisode
    fun getEpisodeCount(): Int = episodes.size

    private fun generateRunId(): String {
        return "run_${System.currentTimeMillis()}_${(0..999).random()}"
    }
}