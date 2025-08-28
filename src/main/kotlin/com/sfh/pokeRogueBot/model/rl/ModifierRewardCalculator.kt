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

        // Critical survival rewards/penalties
        if (outcome.survivedWave) {
            reward += 100.0
        }
        if (outcome.teamWiped) {
            reward -= 200.0
        }

        // Health improvement rewards
        if (outcome.healthImproved) {
            reward += 20.0

            // Bonus for emergency healing when team was low on health
            val avgHp = prevState.hpPercent.average()
            if (avgHp < 0.3) {
                reward += 30.0 // Emergency response bonus
            }
        }

        // Action-specific rewards
        when (action) {
            ModifierAction.BUY_POTION -> {
                if (prevState.canAffordPotion > 0.0 && outcome.healthImproved) {
                    reward += 15.0 // Good economic decision
                } else if (prevState.canAffordPotion == 0.0) {
                    reward -= 10.0 // Tried to buy when couldn't afford
                }
            }

            ModifierAction.TAKE_FREE_POTION -> {
                if (prevState.freePotionAvailable > 0.0 && outcome.healthImproved) {
                    reward += 25.0 // Excellent - free healing
                } else if (prevState.freePotionAvailable == 0.0) {
                    reward -= 5.0 // Invalid action
                }
            }

            ModifierAction.SKIP -> {
                // Neutral action - small penalty if emergency situation was ignored
                val avgHp = prevState.hpPercent.average()
                if (avgHp < 0.2 && (prevState.canAffordPotion > 0.0 || prevState.freePotionAvailable > 0.0)) {
                    reward -= 15.0 // Should have healed in emergency
                } else {
                    reward += 2.0 // Reasonable choice in non-emergency
                }
            }
        }

        // Economic efficiency
        if (outcome.moneySpent > 0) {
            // Penalty for spending without benefit
            if (!outcome.healthImproved) {
                reward -= 5.0
            }
        }

        // Phase management
        if (outcome.phaseEnded && outcome.emergencyResolved) {
            reward += 10.0 // Successfully handled critical situation
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