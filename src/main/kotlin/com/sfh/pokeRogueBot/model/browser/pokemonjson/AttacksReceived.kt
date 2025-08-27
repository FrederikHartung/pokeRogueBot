package com.sfh.pokeRogueBot.model.browser.pokemonjson

data class AttacksReceived(
    val move: Int,
    val result: Int,
    val damage: Int,
    val critical: Boolean,
    val sourceId: Long
)