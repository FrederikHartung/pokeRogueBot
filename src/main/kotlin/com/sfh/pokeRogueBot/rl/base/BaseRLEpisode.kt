package com.sfh.pokeRogueBot.rl.base

import com.sfh.pokeRogueBot.model.rl.RunTerminalOutcome

/**
 * Represents a single RL episode that spans an entire PokeRogue run.
 * Generic implementation that can be used for any RL domain (modifier selection, combat, etc.).
 *
 * RL Episode Design:
 * - Episode = Entire run from start to team wipe/victory
 * - Step = Individual decision within the run
 * - Terminal state = Team wipe or run completion
 *
 * This approach enables long-term learning:
 * - Bad early decisions → team wipe later → negative terminal reward propagated back
 * - Good consistent decisions → long successful run → positive rewards
 * - Credit assignment across multiple decisions
 *
 * Episode Flow:
 * Start → [Step 1: State, Action, Reward] → [Step 2: State, Action, Reward] → ... → Terminal
 *
 * @param TState The type of state representation (e.g., SmallModifierSelectState, CombatState)
 * @param TAction The type of action (e.g., ModifierAction, CombatAction)
 */
data class BaseRLEpisode<TState, TAction>(
    val runId: String,
    val steps: MutableList<BaseRLStep<TState, TAction>> = mutableListOf(),
    var isComplete: Boolean = false,
    var terminalOutcome: RunTerminalOutcome? = null,
    var finalReward: Double = 0.0,
    var waveReached: Int = 0,
    var startTimestamp: Long = System.currentTimeMillis(),
    val isValidForTraining: Boolean = true  // False for resumed runs (waveIndex > 1)
) {

    /**
     * Adds a new step to the episode.
     * @param step The decision step to add
     */
    fun addStep(step: BaseRLStep<TState, TAction>) {
        if (isComplete) {
            throw IllegalStateException("Cannot add step to completed episode")
        }
        steps.add(step)
    }

    /**
     * Completes the episode with terminal outcome and calculates final rewards.
     * @param outcome The terminal outcome (team wipe, victory, etc.)
     * @param waveReached The final wave reached in the run
     * @param terminalRewardCalculator Function to calculate terminal reward based on outcome and wave
     */
    fun complete(
        outcome: RunTerminalOutcome, 
        waveReached: Int, 
        terminalRewardCalculator: (RunTerminalOutcome, Int) -> Double
    ) {
        this.terminalOutcome = outcome
        this.waveReached = waveReached
        this.isComplete = true

        // Calculate terminal reward using provided calculator
        this.finalReward = terminalRewardCalculator(outcome, waveReached)

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
     * Gets all experiences for training, with proper terminal rewards applied.
     */
    fun getAllExperiences(): List<BaseExperience<TState, TAction>> {
        return steps.map { step ->
            val totalReward = step.immediateReward +
                    if (step.isTerminal) step.terminalReward else 0.0

            BaseExperience(
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