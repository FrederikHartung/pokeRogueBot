package com.sfh.pokeRogueBot.model.run

import com.sfh.pokeRogueBot.model.poke.PokemonBenchmarkMetric

data class RunResultBody(
    val money: Int,
    val team: List<PokemonBenchmarkMetric>,
    val waveIndex: Int,
)
