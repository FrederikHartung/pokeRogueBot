package com.sfh.pokeRogueBot.model.browser.pokemonjson

data class SummonData(
    val battleStats: List<Int>?,
    val moveQueue: List<Any>?,
    val disabledMove: Int,
    val disabledTurns: Int,
    val tags: List<Any>?,
    val abilitySuppressed: Boolean,
    val ability: Int
)