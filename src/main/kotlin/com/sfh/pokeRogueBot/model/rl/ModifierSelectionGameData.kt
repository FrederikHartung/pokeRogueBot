package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.modifier.ModifierShop

/**
 * Holds all the game data needed for modifier selection RL decisions.
 * This class aggregates the WaveDto and ModifierShop into a single object
 * that can be passed to the generic BaseRLNeuron.
 */
data class ModifierSelectionGameData(
    val waveDto: WaveDto,
    val shop: ModifierShop
) {
    val waveIndex: Int get() = waveDto.waveIndex
    val money: Int get() = waveDto.money
    val playerParty get() = waveDto.wavePokemon.playerParty
    val shopItems get() = shop.shopItems
    val freeItems get() = shop.freeItems
}