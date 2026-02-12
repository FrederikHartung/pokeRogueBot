package com.sfh.pokeRogueBot.rl.base

/**
 * Represents a single step (decision) within an RL episode.
 * Generic implementation that can be used for any RL domain (modifier selection, combat, etc.).
 *
 * @param TState The type of state representation (e.g., SmallModifierSelectState, CombatState)
 * @param TAction The type of action (e.g., ModifierAction, CombatAction)
 */
data class BaseRLStep<TState, TAction>(
    val state: TState,
    val action: TAction,
    val immediateReward: Double,
    val nextState: TState? = null,
    val waveNumber: Int,
    val isTerminal: Boolean = false,
    val terminalReward: Double = 0.0,
    val timestamp: Long = System.currentTimeMillis()
)