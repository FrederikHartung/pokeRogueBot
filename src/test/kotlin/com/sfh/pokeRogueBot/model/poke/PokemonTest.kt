package com.sfh.pokeRogueBot.model.poke

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class PokemonTest {

    // A normal Potion can heal 20 HP or 10% of the max Health
    @Test
    fun `A full Potion can be used by fixed hp`(){
        val pokemon = Pokemon.createDefault()
        pokemon.stats.hp = 30
        pokemon.hp = 10
        assertTrue { pokemon.fullPotionCanBeUsed() }
    }

    // A normal Potion can heal 20 HP or 10% of the max Health
    @Test
    fun `A full potion can be used by percentage hp`(){
        val pokemon = Pokemon.createDefault()
        pokemon.stats.hp = 300
        pokemon.hp = 250 //more than 10% are missing
        assertTrue { pokemon.fullPotionCanBeUsed() }
    }

    // A normal Potion can heal 20 HP or 10% of the max Health
    @Test
    fun `A Pokemon is minor hurt and a full Potion can not be used`(){
        val pokemon = Pokemon.createDefault()
        pokemon.stats.hp = 100
        pokemon.hp = 95 //less than 10% are missing
        assertFalse { pokemon.fullPotionCanBeUsed() }
    }
}