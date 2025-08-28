package com.sfh.pokeRogueBot.model.rl

/**
 * Represents the outcome of a modifier selection decision for reward calculation.
 *
 * This class captures the key metrics needed to evaluate the effectiveness of
 * modifier selection decisions in the RL training process. The outcome is measured
 * after the decision has been executed and its effects have been observed.
 *
 * @param survivedWave Whether the team survived the current wave after the decision
 * @param teamWiped Whether the entire team was defeated
 * @param healthImproved Whether team health increased as a result of the decision
 * @param moneySpent Amount of money spent on the selected modifier
 * @param phaseEnded Whether the modifier selection phase ended after this action
 * @param emergencyResolved Whether a critical situation (low HP/fainted Pokemon) was addressed
 */
data class ModifierOutcome(
    val survivedWave: Boolean,
    val teamWiped: Boolean,
    val healthImproved: Boolean,
    val moneySpent: Int,
    val phaseEnded: Boolean,
    val emergencyResolved: Boolean
)