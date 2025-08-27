package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class BattleEntry(
    @SerializedName("battleType")
    val battleType: Int,

    @SerializedName("seedOffsetWaveIndex")
    val seedOffsetWaveIndex: Int?
)