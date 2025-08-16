package com.sfh.pokeRogueBot.model.poke

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Status
import com.sfh.pokeRogueBot.model.enums.Gender
import com.sfh.pokeRogueBot.model.enums.Nature

data class PokemonBenchmarkMetric(
    val name: String,
    val gender: Gender?,
    val id: Long,
    val ivs: Iv,
    val level: Int,
    val luck: Int,
    val moveset: Array<Move>,
    val nature: Nature,
    val pokerus: Boolean,
    val shiny: Boolean,
    val species: Species,
    val stats: Stats,
    val status: Status?,
) {
    companion object {
        fun toSnapshotMetric(pokemon: Pokemon): PokemonBenchmarkMetric {
            return PokemonBenchmarkMetric(
                pokemon.name,
                pokemon.gender,
                pokemon.id,
                pokemon.ivs,
                pokemon.level,
                pokemon.luck,
                pokemon.moveset,
                pokemon.nature,
                pokemon.pokerus,
                pokemon.isShiny,
                pokemon.species,
                pokemon.stats,
                pokemon.status
            )
        }
    }
}
