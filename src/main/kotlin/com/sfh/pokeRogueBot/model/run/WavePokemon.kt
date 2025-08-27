package com.sfh.pokeRogueBot.model.run

import com.google.gson.annotations.SerializedName
import com.sfh.pokeRogueBot.model.poke.Pokemon

data class WavePokemon(
    var enemyParty: List<Pokemon>,
    @SerializedName("ownParty")
    var playerParty: List<Pokemon>
)