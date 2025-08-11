package com.sfh.pokeRogueBot.model.run

import com.google.gson.annotations.SerializedName
import com.sfh.pokeRogueBot.model.poke.Pokemon

data class WavePokemon(
    var enemyParty: Array<Pokemon>? = null,
    @SerializedName("ownParty")
    var playerParty: Array<Pokemon>? = null
)