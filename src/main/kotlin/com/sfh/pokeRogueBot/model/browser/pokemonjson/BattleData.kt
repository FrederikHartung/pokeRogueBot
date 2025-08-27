package com.sfh.pokeRogueBot.model.browser.pokemonjson

data class BattleData(
    val hitCount: Int,
    val endured: Boolean,
    val berriesEaten: List<Any>?,
    val abilitiesApplied: List<Any>?
)