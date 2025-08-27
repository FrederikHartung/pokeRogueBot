package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class GameJsonNode(
    @SerializedName("biome")
    val biome: String?,

    @SerializedName("money")
    val money: Int,

    @SerializedName("wave")
    val wave: Int,

    @SerializedName("gameMode")
    val gameMode: GameMode?,

    @SerializedName("gameData")
    val gameData: GameData?,

    val gameSpeed: Float?,
    val pokeballCounts: Map<String, Int>?,

    @SerializedName("currentBattle")
    val currentBattle: CurrentBattle?
)