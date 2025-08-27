package com.sfh.pokeRogueBot.model.browser.pokemonjson

data class TurnData(
    val damageDealt: Int,
    val currDamageDealt: Int,
    val damageTaken: Int,
    val attacksReceived: List<AttacksReceived>?,
    val acted: Boolean,
    val hitCount: Int,
    val hitsLeft: Int
)