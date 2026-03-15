package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import org.springframework.stereotype.Component
import kotlin.random.Random

@Component
class RandomMoveOrSwitchCombatSwitchPolicy(
    private val support: CombatPolicySupport,
    private val heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
) : CombatSwitchPolicy {

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        if (waveDto.isDoubleFight) {
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        }

        val attackDecision = support.chooseRandomSingleAttackDecision(waveDto)
        val switchDecision = support.chooseRandomSwitchDecision(waveDto, true)
        val options = buildList {
            if (attackDecision != null) {
                add(
                    CombatCommandChoice(
                        commandDecision = CommandPhaseDecision.ATTACK,
                        attackDecision = attackDecision,
                    )
                )
            }
            if (switchDecision != null) {
                add(
                    CombatCommandChoice(
                        commandDecision = CommandPhaseDecision.SWITCH,
                        switchDecision = switchDecision,
                    )
                )
            }
        }

        return options.randomOrNull() ?: heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return support.chooseRandomSwitchDecision(waveDto, ignoreFirstPokemon)
            ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return support.chooseRandomSwitchDecision(waveDto, ignoreFirstPokemon)
            ?: heuristicCombatSwitchPolicy.chooseForcedSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean {
        if (waveDto.isDoubleFight) {
            return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        }
        return support.getSwitchCandidateIndices(waveDto).isNotEmpty() && Random.nextBoolean()
    }
}
