package com.sfh.pokeRogueBot.config

import com.sfh.pokeRogueBot.model.enums.CombatPolicyMode
import com.sfh.pokeRogueBot.service.combat.CombatSwitchPolicy
import com.sfh.pokeRogueBot.service.combat.DqnCombatSwitchPolicy
import com.sfh.pokeRogueBot.service.combat.HeuristicCombatSwitchPolicy
import com.sfh.pokeRogueBot.service.combat.RandomMoveOnlyCombatSwitchPolicy
import com.sfh.pokeRogueBot.service.combat.RandomMoveOrSwitchCombatSwitchPolicy
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class CombatSwitchPolicyConfig {

    @Bean
    fun combatSwitchPolicy(
        @Value("\${bot.combat-policy-mode:random_move}") combatPolicyModeRaw: String,
        heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
        randomMoveOnlyCombatSwitchPolicy: RandomMoveOnlyCombatSwitchPolicy,
        randomMoveOrSwitchCombatSwitchPolicy: RandomMoveOrSwitchCombatSwitchPolicy,
        dqnCombatSwitchPolicy: DqnCombatSwitchPolicy,
    ): CombatSwitchPolicy {
        val combatPolicyMode = CombatPolicyMode.fromConfigValue(combatPolicyModeRaw)
        return when (combatPolicyMode) {
            CombatPolicyMode.HEURISTIC -> heuristicCombatSwitchPolicy
            CombatPolicyMode.RANDOM_MOVE_ONLY -> randomMoveOnlyCombatSwitchPolicy
            CombatPolicyMode.RANDOM_MOVE_OR_SWITCH -> randomMoveOrSwitchCombatSwitchPolicy
            CombatPolicyMode.DQN -> dqnCombatSwitchPolicy
        }
    }
}
