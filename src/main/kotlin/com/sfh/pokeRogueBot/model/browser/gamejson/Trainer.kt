package com.sfh.pokeRogueBot.model.browser.gamejson

import com.google.gson.annotations.SerializedName

data class Trainer(
    val name: String?,
    @SerializedName("config")
    val config: TrainerConfig?
)