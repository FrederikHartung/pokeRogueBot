package com.sfh.pokeRogueBot.model.bridge

import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.run.WavePokemon
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path

class WaveBridgeContractTest {

    private val gson = GsonBuilder().create()
    private val coreFixturePath = Path.of("src", "test", "resources", "bridge", "wave", "wave-core.json")
    private val pokemonFixturePath = Path.of("src", "test", "resources", "bridge", "wave", "wave-pokemons.json")

    @Test
    fun `wave bridge fixtures deserialize into kotlin model`() {
        val waveDto = deserializeFixture()

        assertEquals(1, waveDto.waveIndex)
        assertEquals(1, waveDto.turn)
        assertEquals(120, waveDto.money)
        assertEquals("PLAINS", waveDto.arena?.biome?.name)
        assertEquals("SWITCH", waveDto.battleStyle?.name)
        assertEquals("WILD", waveDto.battleType?.name)
        assertFalse(waveDto.isDoubleFight)
        assertEquals(5, waveDto.pokeballCount[0])
        assertEquals(1, waveDto.wavePokemon.enemyParty.size)
        assertEquals(1, waveDto.wavePokemon.playerParty.size)
        assertEquals("Pidgey", waveDto.wavePokemon.enemyParty.first().name)
        assertEquals("Bulbasaur", waveDto.wavePokemon.playerParty.first().name)
    }

    @Test
    fun `wave bridge fixture passes sanity validation`() {
        val waveDto = deserializeFixture()

        validateWaveContract(waveDto)
    }

    private fun deserializeFixture(): WaveDto {
        check(Files.exists(coreFixturePath)) { "Missing fixture at $coreFixturePath" }
        check(Files.exists(pokemonFixturePath)) { "Missing fixture at $pokemonFixturePath" }
        val waveDto = gson.fromJson(Files.readString(coreFixturePath), WaveDto::class.java)
        val wavePokemon = gson.fromJson(Files.readString(pokemonFixturePath), WavePokemon::class.java)
        waveDto.wavePokemon = wavePokemon
        return waveDto
    }

    private fun validateWaveContract(waveDto: WaveDto) {
        require(waveDto.waveIndex >= 0) { "waveIndex must not be negative" }
        require(waveDto.turn >= 0) { "turn must not be negative" }
        require(waveDto.money >= 0) { "money must not be negative" }
        require(waveDto.enemyFaints >= 0) { "enemyFaints must not be negative" }
        require(waveDto.playerFaints >= 0) { "playerFaints must not be negative" }
        require(waveDto.pokeballCount.size == 5) { "pokeballCount must contain exactly 5 entries" }
        require(waveDto.pokeballCount.all { it >= 0 }) { "pokeballCount entries must not be negative" }
        require(waveDto.wavePokemon.enemyParty.isNotEmpty()) { "enemyParty must not be empty" }
        require(waveDto.wavePokemon.playerParty.isNotEmpty()) { "playerParty must not be empty" }
        assertNotNull(waveDto.arena, "arena must not be null")
        assertNotNull(waveDto.battleStyle, "battleStyle must not be null")
        assertNotNull(waveDto.battleType, "battleType must not be null")
        assertTrue(waveDto.isWildPokemonFight())
        assertFalse(waveDto.isTrainerFight())
        assertTrue(waveDto.hasPokeBalls())
    }
}
