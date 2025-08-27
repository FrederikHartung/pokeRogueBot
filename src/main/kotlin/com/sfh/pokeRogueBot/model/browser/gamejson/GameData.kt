package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class GameData(
    @SerializedName("gameStats")
    val gameStats: GameStats?,

    @SerializedName("eggs")
    val eggs: List<Any>?,

    @SerializedName("starterData")
    val starterData: Map<String, StarterDataEntry>?,

    @SerializedName("voucherCounts")
    val voucherCounts: Map<String, Int>?
)