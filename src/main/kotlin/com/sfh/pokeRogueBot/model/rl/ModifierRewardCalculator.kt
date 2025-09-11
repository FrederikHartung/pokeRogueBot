package com.sfh.pokeRogueBot.model.rl

import org.slf4j.LoggerFactory

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
object ModifierRewardCalculator {

    private val log = LoggerFactory.getLogger(ModifierRewardCalculator::class.java)

    /**
     * Calculates the reward for a modifier selection decision.
     *
     * @param prevState The game state before the action was taken
     * @param action The modifier action that was selected
     * @return Reward value for training the RL agent
     */
    fun calculateReward(
        prevState: SmallModifierSelectState,
        action: ModifierAction,
    ): Double {
        var reward = 0.0

        // Action-specific rewards
        val lowestHp = prevState.hpBuckets.filter { hp -> hp > 0 }.minOrNull() ?: 1.0
        val faintedPokemonAvailable = prevState.hpBuckets.any { hp -> hp == 0.0 }
        when (action) {
            ModifierAction.SKIP -> {
                //Penalty when a Pokemon was hurt and no FreePotion was taken
                if (lowestHp < 1 && prevState.freePotionAvailable > 0.0) {
                    reward -= 2.0 // Should take free Potion
                }

                //Penalty when a Pokemon is fainted and a free revive Item was offered
                if(faintedPokemonAvailable && prevState.freeReviveAvailable == 0.5){
                    reward -= 5.0 // Should take free Revive
                }

                //Penalty when a Pokemon is fainted and a free max revive Item was offered
                if(faintedPokemonAvailable && prevState.freeReviveAvailable > 0.5){
                    reward -= 10.0 // Should take free Max Revive
                }

                //Penalty when a Pokemon is fainted and a free Sacret Ash was offered
                if(faintedPokemonAvailable && prevState.sacredAshAvailable > 0.0){
                    reward -= 15.0 // Should take free Sacret Ash
                }
            }
            else -> reward += 0.0 //no Penalty/Reward
        }

        log.debug("immediate reward: {}", reward)

        return reward
    }
}