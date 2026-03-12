package com.sfh.pokeRogueBot.model.bridge

import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats
import com.sfh.pokeRogueBot.model.poke.Pokemon
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path

class PokemonBridgeContractTest {

    private val gson = GsonBuilder().create()
    private val fixturePath = Path.of("src", "test", "resources", "bridge", "pokemon", "bulbasaur-single.json")

    @Test
    fun `pokemon bridge fixture deserializes into kotlin model`() {
        val pokemon = deserializeFixture()

        assertEquals("Bulbasaur", pokemon.name)
        assertEquals(5, pokemon.level)
        assertEquals(3, pokemon.moveset.size)
        assertEquals("Tackle", pokemon.moveset[0].name)
        assertTrue(pokemon.moveset.all { it.isUsable })
        assertEquals("Bulbasaur", pokemon.species.speciesString)
        assertEquals(45, pokemon.species.baseStats.hp)
        assertEquals(20, pokemon.stats.hp)
        assertEquals(20, pokemon.hp)
        assertTrue(pokemon.player)
        assertFalse(pokemon.isBoss)
        assertNotNull(pokemon.status)
    }

    @Test
    fun `pokemon bridge fixture passes sanity validation`() {
        val pokemon = deserializeFixture()

        validatePokemonContract(pokemon)
    }

    private fun deserializeFixture(): Pokemon {
        check(Files.exists(fixturePath)) { "Missing fixture at $fixturePath" }
        val json = Files.readString(fixturePath)
        return gson.fromJson(json, Pokemon::class.java)
    }

    private fun validatePokemonContract(pokemon: Pokemon) {
        require(pokemon.name.isNotBlank()) { "Pokemon name must not be blank" }
        require(pokemon.id > 0) { "Pokemon id must be positive" }
        require(pokemon.level > 0) { "Pokemon level must be positive" }
        require(pokemon.hp >= 0) { "Pokemon hp must not be negative" }
        require(pokemon.stats.hp > 0) { "Pokemon max hp must be positive" }
        require(pokemon.moveset.isNotEmpty()) { "Pokemon moveset must not be empty" }
        require(pokemon.species.speciesString.isNotBlank()) { "Species name must not be blank" }
        require(pokemon.species.baseStats.getBaseTotal() == pokemon.species.baseTotal) {
            "Species baseTotal must match sum of baseStats"
        }

        pokemon.moveset.forEachIndexed { index, move ->
            validateMoveContract(index, move)
        }

        validateStats("ivs", pokemon.ivs.hp, pokemon.ivs.attack, pokemon.ivs.defense, pokemon.ivs.specialAttack, pokemon.ivs.specialDefense, pokemon.ivs.speed)
        validateStatsObject("stats", pokemon.stats)
        validateStatsObject("species.baseStats", pokemon.species.baseStats)
    }

    private fun validateMoveContract(index: Int, move: Move) {
        require(move.name.isNotBlank()) { "Move[$index] name must not be blank" }
        require(move.id > 0) { "Move[$index] id must be positive" }
        require(move.movePp >= 0) { "Move[$index] movePp must not be negative" }
        require(move.pPUsed >= 0) { "Move[$index] pPUsed must not be negative" }
        require(move.pPLeft >= 0) { "Move[$index] pPLeft must not be negative" }
        require(move.pPUsed <= move.movePp) { "Move[$index] pPUsed must be <= movePp" }
        require(move.pPLeft == move.movePp - move.pPUsed) {
            "Move[$index] pPLeft must equal movePp - pPUsed"
        }
    }

    private fun validateStatsObject(label: String, stats: Stats) {
        validateStats(label, stats.hp, stats.attack, stats.defense, stats.specialAttack, stats.specialDefense, stats.speed)
    }

    private fun validateStats(label: String, hp: Int, attack: Int, defense: Int, specialAttack: Int, specialDefense: Int, speed: Int) {
        require(hp >= 0) { "$label.hp must not be negative" }
        require(attack >= 0) { "$label.attack must not be negative" }
        require(defense >= 0) { "$label.defense must not be negative" }
        require(specialAttack >= 0) { "$label.specialAttack must not be negative" }
        require(specialDefense >= 0) { "$label.specialDefense must not be negative" }
        require(speed >= 0) { "$label.speed must not be negative" }
    }
}
