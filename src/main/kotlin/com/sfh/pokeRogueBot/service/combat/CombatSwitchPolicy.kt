package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto

interface CombatSwitchPolicy {
    fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice
    fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision?
    fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision?
    fun shouldSwitchPokemon(waveDto: WaveDto): Boolean
}
