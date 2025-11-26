package com.sfh.pokeRogueBot.rl.base

/**
 * Represents a single training experience for reinforcement learning.
 * Generic implementation that can be used for any RL domain.
 *
 * This data class encapsulates one step of interaction with the environment,
 * containing all the information needed for Q-learning updates. Each experience
 * represents a (state, action, reward, next_state) tuple that forms the basis
 * of the agent's learning process.
 *
 * @param TState The type of state representation (e.g., SmallModifierSelectState, CombatState)
 * @param TAction The type of action (e.g., ModifierAction, CombatAction)
 * @param state The game state before the action was taken
 * @param action The action that was selected by the agent
 * @param reward The reward received for taking this action
 * @param nextState The resulting game state after the action (null if terminal)
 * @param done Whether this experience represents a terminal state
 * @param timestamp When this experience occurred (for debugging and analysis)
 */
data class BaseExperience<TState, TAction>(
    val state: TState,
    val action: TAction,
    val reward: Double,
    val nextState: TState?,
    val done: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)