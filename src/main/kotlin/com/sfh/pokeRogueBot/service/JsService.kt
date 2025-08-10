package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.browser.JsClient
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto
import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.run.Starter
import com.sfh.pokeRogueBot.model.run.WavePokemon
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.nio.file.Path
import java.nio.file.Paths

@Service
class JsService(private val jsClient: JsClient) {

    companion object {
        private val log = LoggerFactory.getLogger(JsService::class.java)
        private val UTIL: Path = Paths.get(".", "bin", "js", "util.js")
        private val UI_HANDLER: Path = Paths.get(".", "bin", "js", "uihandler.js")
        private val POKE: Path = Paths.get(".", "bin", "js", "poke.js")
        private val WAVE: Path = Paths.get(".", "bin", "js", "wave.js")
        private val MODIFIER: Path = Paths.get(".", "bin", "js", "modifier.js")
        private val STARTER: Path = Paths.get(".", "bin", "js", "starter.js")
        private val EGG: Path = Paths.get(".", "bin", "js", "egg.js")
        private val GSON: Gson = GsonBuilder()
            .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
            .create()
    }

    fun init() {
        jsClient.addScriptToWindow(UTIL)
        jsClient.addScriptToWindow(UI_HANDLER)
        jsClient.addScriptToWindow(POKE)
        jsClient.addScriptToWindow(WAVE)
        jsClient.addScriptToWindow(MODIFIER)
        jsClient.addScriptToWindow(STARTER)
        jsClient.addScriptToWindow(EGG)
    }

    fun getCurrentPhaseAsString(): String {
        return jsClient.executeCommandAndGetResult("return window.poru.util.getPhaseName();").toString()
    }

    fun getUiMode(): UiMode {
        val result = jsClient.executeCommandAndGetResult("return window.poru.util.getUiMode();")
        return if (result is Long) {
            UiMode.fromValue(result.toInt())
        } else {
            UiMode.UNKNOWN
        }
    }

    fun getModifierShop(): ModifierShop {
        val json = jsClient.executeCommandAndGetResult("return window.poru.uihandler.getModifierShopItemsJson();").toString()
        return GSON.fromJson(json, ModifierShop::class.java)
    }

    fun getWaveDto(): WaveDto {
        val waveJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWaveJson();").toString()
        val waveDto = GSON.fromJson(waveJson, WaveDto::class.java)
        val wavePokemon = getWavePokemon()
        waveDto.wavePokemon = wavePokemon
        return waveDto
    }

    fun getWavePokemon(): WavePokemon {
        val pokemonJson = jsClient.executeCommandAndGetResult("return window.poru.wave.getWavePokemonsJson();").toString()
        return GSON.fromJson(pokemonJson, WavePokemon::class.java)
    }

    fun setModifierOptionsCursor(rowIndex: Int, columnIndex: Int): Boolean {
        log.debug("Setting modifier options cursor to row: $rowIndex, column: $columnIndex")
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setModifierSelectUiHandlerCursor(%s, %s)"
            .format(columnIndex, rowIndex)).toString()
        return result.toBoolean()
    }

    fun setPartyCursor(index: Int): Boolean {
        log.debug("Setting party cursor to index: $index")
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setPartyUiHandlerCursor(%s)"
            .format(index)).toString()
        return result.toBoolean()
    }

    fun setPokeBallCursor(index: Int): Boolean {
        log.debug("Setting pokeball cursor to index: $index")
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setBallUiHandlerCursor(%s)"
            .format(index)).toString()
        return result.toBoolean()
    }

    fun getAvailableStarterPokemon(): Array<Starter> {
        log.debug("Getting starter pokemon")
        val result = jsClient.executeCommandAndGetResult("return window.poru.starter.getPossibleStarterJson();").toString()
        return GSON.fromJson(result, Array<Starter>::class.java)
    }

    fun setPokemonSelectCursor(speciesId: Int): Boolean {
        log.debug("Setting pokemon select cursor to speciesId: $speciesId")
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.setStarterSelectUiHandlerCursor(%s);"
            .format(speciesId)).toString()
        return result.toBoolean()
    }

    fun confirmPokemonSelect(): Boolean {
        log.debug("Confirming pokemon select")
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.confirmStarterSelect();").toString()
        return result.toBoolean()
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

    fun saveAndQuit(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.saveAndQuit();").toString().toBoolean()
    }

    fun setCursorToLoadGame(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToLoadGame();").toString().toBoolean()
    }

    fun setCursorToNewGame(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToNewGame();").toString().toBoolean()
    }

    fun setCursorToSaveSlot(index: Int): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setCursorToSaveSlot(%s);".format(index)).toString().toBoolean()
    }

    fun getSaveSlots(): Array<SaveSlotDto> {
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.getSaveSlotsJson();").toString()
        return GSON.fromJson(result, Array<SaveSlotDto>::class.java)
    }

    fun submitUserData(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.pressLoginButton();").toString().toBoolean()
    }

    fun getPokemonInLearnMove(): Pokemon {
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.getPokemonInLearnMovePhaseJson();").toString()
        return GSON.fromJson(result, Pokemon::class.java)
    }

    fun setLearnMoveCursor(moveIndexToReplace: Int): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setLearnMoveCursor(%s);".format(moveIndexToReplace)).toString().toBoolean()
    }

    fun addBallToInventory() {
        jsClient.executeCommandAndGetResult("window.poru.util.addBallToInventory();")
    }
}