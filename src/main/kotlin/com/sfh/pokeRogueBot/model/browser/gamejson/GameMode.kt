package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class GameMode(
    @SerializedName("battleConfig")
    val battleConfig: Map<String, BattleEntry>?
)