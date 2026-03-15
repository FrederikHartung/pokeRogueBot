package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class RandomMoveOnlyCombatSwitchPolicy(
    private val support: CombatPolicySupport,
    private val heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
) : CombatSwitchPolicy {

    companion object {
        private val log = LoggerFactory.getLogger(RandomMoveOnlyCombatSwitchPolicy::class.java)
    }

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        if (waveDto.isDoubleFight) {
            log.debug("Double fight detected, delegating command action to heuristic policy")
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        }

        val attackDecision = support.chooseRandomSingleAttackDecision(waveDto)
        if (attackDecision != null) {
            log.debug("Command action resolved to ATTACK via random_move policy")
            return CombatCommandChoice(
                commandDecision = CommandPhaseDecision.ATTACK,
                attackDecision = attackDecision,
            )
        }

        log.debug("No valid attack decision found in random_move policy, falling back to SWITCH")
        val switchDecision = chooseSwitchDecision(waveDto, true)
        log.debug("Switch fallback decision in random_move policy: {}", switchDecision)

        return CombatCommandChoice(
            commandDecision = CommandPhaseDecision.SWITCH,
            switchDecision = switchDecision,
        )
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return support.chooseRandomSwitchDecision(waveDto, ignoreFirstPokemon)
            ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return support.chooseRandomSwitchDecision(waveDto, ignoreFirstPokemon)
            ?: heuristicCombatSwitchPolicy.chooseForcedSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean = false
}
