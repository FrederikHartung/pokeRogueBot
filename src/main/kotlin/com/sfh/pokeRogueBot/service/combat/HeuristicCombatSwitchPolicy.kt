package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import com.sfh.pokeRogueBot.neurons.CapturePokemonNeuron
import com.sfh.pokeRogueBot.neurons.CombatNeuron
import com.sfh.pokeRogueBot.neurons.SwitchPokemonNeuron
import org.springframework.stereotype.Component

@Component
class HeuristicCombatSwitchPolicy(
    private val combatNeuron: CombatNeuron,
    private val switchPokemonNeuron: SwitchPokemonNeuron,
    private val capturePokemonNeuron: CapturePokemonNeuron,
) : CombatSwitchPolicy {

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        val attackDecision = chooseAttackDecision(waveDto, tryToCatch)
        if (attackDecision != null) {
            return CombatCommandChoice(
                commandDecision = CommandPhaseDecision.ATTACK,
                attackDecision = attackDecision,
            )
        }

        return CombatCommandChoice(
            commandDecision = CommandPhaseDecision.SWITCH,
            switchDecision = chooseSwitchDecision(waveDto, true),
        )
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return switchPokemonNeuron.getBestSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        return switchPokemonNeuron.getBestSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean {
        return switchPokemonNeuron.shouldSwitchPokemon(waveDto)
    }

    private fun chooseAttackDecision(waveDto: WaveDto, tryToCatch: Boolean): AttackDecision? {
        return if (waveDto.isDoubleFight) {
            val playerParty = waveDto.wavePokemon.playerParty
            val enemyParty = waveDto.wavePokemon.enemyParty

            val playerPokemon1 = playerParty.getOrNull(0)?.takeIf { it.isAlive() }
            val playerPokemon2 = playerParty.getOrNull(1)?.takeIf { it.isAlive() }
            val enemyPokemon1 = enemyParty.getOrNull(0)?.takeIf { it.isAlive() }
            val enemyPokemon2 = enemyParty.getOrNull(1)?.takeIf { it.isAlive() }

            combatNeuron.getAttackDecisionForDoubleFight(
                playerPokemon1,
                playerPokemon2,
                enemyPokemon1,
                enemyPokemon2,
            )
        } else {
            val enemyPokemon = waveDto.wavePokemon.enemyParty.firstOrNull()
                ?: throw IllegalStateException("No enemy pokemon found in enemyParty")
            combatNeuron.getAttackDecisionForSingleFight(
                waveDto.wavePokemon.playerParty[0],
                enemyPokemon,
                tryToCatch || capturePokemonNeuron.shouldCapturePokemon(waveDto, enemyPokemon),
            )
        }
    }
}
