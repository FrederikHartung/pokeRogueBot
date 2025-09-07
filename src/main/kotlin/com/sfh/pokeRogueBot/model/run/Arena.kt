package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.enums.Biome

data class Arena(
    var biome: Biome? = null,
    var lastTimeOfDay: Int = 0
)