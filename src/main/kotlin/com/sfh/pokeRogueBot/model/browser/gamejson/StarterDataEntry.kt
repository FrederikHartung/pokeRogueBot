package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class StarterDataEntry(
    @SerializedName("moveset")
    val moveset: Any?,

    @SerializedName("eggMoves")
    val eggMoves: Int,

    @SerializedName("candyCount")
    val candyCount: Int,

    @SerializedName("friendship")
    val friendship: Int,

    @SerializedName("abilityAttr")
    val abilityAttr: Int,

    @SerializedName("passiveAttr")
    val passiveAttr: Int,

    @SerializedName("valueReduction")
    val valueReduction: Int,

    @SerializedName("classicWinCount")
    val classicWinCount: Int
)