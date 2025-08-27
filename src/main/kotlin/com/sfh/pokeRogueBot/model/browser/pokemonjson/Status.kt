package com.sfh.pokeRogueBot.model.browser.pokemonjson

import com.sfh.pokeRogueBot.model.enums.StatusEffect

data class Status(
    var effect: StatusEffect?,
    var turnCount: Int
) {
    fun getCatchRateModificatorForStatusEffect(): Float {
        return when (effect) {
            StatusEffect.NONE -> 1f
            StatusEffect.POISON, StatusEffect.PARALYSIS, StatusEffect.TOXIC, StatusEffect.BURN -> 1.5f
            StatusEffect.SLEEP, StatusEffect.FREEZE -> 2.5f
            else -> throw IllegalArgumentException("Unknown status effect: $effect")
        }
    }
}