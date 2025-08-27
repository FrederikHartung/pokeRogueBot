package com.sfh.pokeRogueBot.model.browser.gamejson

data class CurrentBattle(
    val trainer: Trainer?,
    val seenEnemyPartyMemberIds: Map<String, Any>?,
    val turn: Int,
    val turnCommands: Map<String, Any>?,
    val enemySwitchCounter: Int,
    val escapeAttempts: Int,
    val lastUsedPokeball: Any?,
    val moneyScattered: Int,
    val playerParticipantIds: Map<String, Any>?,
    val postBattleLoot: List<Any>?
)