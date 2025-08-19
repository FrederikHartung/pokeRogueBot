package com.sfh.pokeRogueBot.model.decisions

data class SwitchDecision(
    val index: Int,
    val pokeName: String,
    val playerDamageMultiplier: Float,
    val enemyDamageMultiplier: Float
) {
    val combinedDamageMultiplier: Float = playerDamageMultiplier - enemyDamageMultiplier
}