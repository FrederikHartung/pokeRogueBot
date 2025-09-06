package com.sfh.pokeRogueBot.model.rl

/**
 * Calculates reward signals for reinforcement learning based on modifier selection outcomes.
 *
 * This class implements the reward function for the RL agent, providing feedback on the
 * quality of modifier selection decisions. The reward structure is designed to encourage
 * survival-focused and economically efficient decision making.
 *
 * Reward Structure:
 * - High rewards for survival and emergency response
 * - Moderate rewards for health improvement and efficient resource usage
 * - Penalties for wasteful spending and team wipes
 * - Bonus rewards for resolving critical situations (low HP, fainted Pokemon)
 */
class ModifierRewardCalculator {

    /**
     * Calculates the reward for a modifier selection decision.
     *
     * @param prevState The game state before the action was taken
     * @param action The modifier action that was selected
     * @param outcome The observed outcome after the action was executed
     * @return Reward value for training the RL agent
     */
    fun calculateReward(
        prevState: SmallModifierSelectState,
        action: ModifierAction,
        outcome: ModifierOutcome
    ): Double {
        var reward = 0.0

        when (outcome.phaseEnded) {
            true -> {
                //rewards only after the SelectModifierPhase ended or Run is Lost

                // Critical survival rewards/penalties
                if (outcome.survivedWave) {
                    reward += 100.0
                } else {
                    reward -= 200.0
                }
            }

            false -> {
                // Action-specific rewards
                when (action) {
                    ModifierAction.BUY_POTION -> {
                        // Shop item purchase rewards
                        if (outcome.fullPotionUsed) {
                            reward += 15.0 // Good economic decision
                        }
                        // Add more item-specific rewards here as needed
                    }

                    ModifierAction.TAKE_FREE_POTION -> {
                        // Free item selection rewards
                        reward += 5.0 // Excellent - free healing
                        // Add more item-specific rewards here as needed
                    }

                    ModifierAction.SKIP -> {
                        //Penalty when a Pokemon was hurt and no FreePotion was taken
                        val lowestHp = prevState.hpBuckets.filter { hp -> hp > 0 }.minOrNull() ?: 1.0
                        if (lowestHp < 1 && prevState.freePotionAvailable > 0.0) {
                            reward -= 15.0 // Should take free Potion
                        } else {
                            reward += 2.0 // Reasonable choice in non-emergency
                        }

                        //Penalty when a Pokemon was lower than 0.8 Health when a Potion was buyable
                        if (lowestHp < 0.8 && prevState.canAffordPotion > 0.0) {
                            reward -= 15.0 // Should buy Potion
                        } else {
                            reward += 2.0 // Reasonable choice when healing not needed
                        }
                    }
                }
            }
        }

        return reward
    }

    /**
     * Calculates a normalized reward based on team health improvement.
     *
     * @param healthBefore Average HP percentage before action
     * @param healthAfter Average HP percentage after action
     * @return Normalized health improvement reward (0.0 to 20.0)
     */
    private fun calculateHealthReward(healthBefore: Double, healthAfter: Double): Double {
        val improvement = healthAfter - healthBefore
        return kotlin.math.max(0.0, improvement * 20.0) // Scale 0.0-1.0 improvement to 0.0-20.0 reward
    }
}