package com.sfh.pokeRogueBot.service.javascript

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.browser.JsClient
import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.run.Starter
import com.sfh.pokeRogueBot.model.run.WavePokemon
import org.springframework.stereotype.Service

@Service
class JsService(private val jsClient: JsClient) {

    private val GSON: Gson = GsonBuilder()
        .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
        .create()

    fun getCurrentPhaseAsString(): String {
        return jsClient.executeCommandAndGetResult("return window.poru.util.getPhaseName();").toString()
    }

    fun getUiMode(): UiMode {
        val result = jsClient.executeCommandAndGetResult("return window.poru.util.getUiMode();")
        return if (result is Long) {
            UiMode.fromValue(result.toInt())
        } else {
            throw UnsupportedUiModeException("" + result)
        }
    }

    fun getWaveDto(): WaveDto {
        val waveJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWaveJson();").toString()
        val waveDto = GSON.fromJson(waveJson, WaveDto::class.java)
        val wavePokemon = getWavePokemon()
        waveDto.wavePokemon = wavePokemon
        return waveDto
    }

    fun getWavePokemon(): WavePokemon {
        val pokemonJson =
            jsClient.executeCommandAndGetResult("return window.poru.wave.getWavePokemonsJson();").toString()
        return GSON.fromJson(pokemonJson, WavePokemon::class.java)
    }

    @Deprecated("broken")
    fun getAvailableStarterPokemon(): Array<Starter> {
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.starter.getPossibleStarterJson();").toString()
        return GSON.fromJson(result, Array<Starter>::class.java)
    }

    fun getWaveAndTurnIndex(): WaveAndTurnDto {
        val result = jsClient.executeCommandAndGetResult("return window.poru.util.getWaveAndTurnJson();").toString()
        return GSON.fromJson(result, WaveAndTurnDto::class.java)
    }

    fun getHatchedPokemon(): Pokemon {
        val result = jsClient.executeCommandAndGetResult("return window.poru.egg.getHatchedPokemonJson();").toString()
        return GSON.fromJson(result, Pokemon::class.java)
    }

    fun getEggId(): Long {
        return jsClient.executeCommandAndGetResult("return window.poru.egg.getEggId();").toString().toLong()
    }

    fun addBallToInventory() {
        jsClient.executeCommandAndGetResult("window.poru.util.addBallToInventory();")
    }

    fun getNumberOfSelectedStarters(): Int {
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.starter.getNumberOfSelectedStarters();").toString()
                .toInt()
        if (result == -1) {
            throw IllegalStateException("Unable to get getNumberOfSelectedStarters")
        }
        return result
    }

    fun isUiHandlerActive(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.util.isUiHandlerActive();").toString()
            .toBoolean()
    }
}