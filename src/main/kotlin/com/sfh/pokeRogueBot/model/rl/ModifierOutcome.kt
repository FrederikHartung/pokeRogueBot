package com.sfh.pokeRogueBot.model.rl

/**
 * Represents the outcome of a modifier selection decision for reward calculation.
 *
 * This class captures the key metrics needed to evaluate the effectiveness of
 * modifier selection decisions in the RL training process. The outcome is measured
 * after the decision has been executed and its effects have been observed.
 *
 * @param survivedWave Whether the team survived the current wave after the decision
 * @param phaseEnded Whether the modifier selection phase ended after this action
 */
data class ModifierOutcome(
    val survivedWave: Boolean,
    val fullPotionUsed: Boolean,
    val phaseEnded: Boolean,
)