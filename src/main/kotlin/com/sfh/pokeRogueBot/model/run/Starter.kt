package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.poke.Species

data class Starter(
    var speciesId: Int = 0,
    var species: Species? = null,
    var cost: Float = 0f
)