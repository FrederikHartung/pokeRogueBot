package com.sfh.pokeRogueBot.service.javascript

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.browser.JsClient
import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandler
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class JsUiService(private val jsClient: JsClient) {

    private val log = LoggerFactory.getLogger(JsUiService::class.java)
    private val GSON: Gson = GsonBuilder()
        .registerTypeAdapter(ChooseModifierItem::class.java, ChooseModifierItemDeserializer())
        .create()

    fun getModifierShop(): ModifierShop {
        val json =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.getModifierShopItemsJson();").toString()
        return GSON.fromJson(json, ModifierShop::class.java)
    }

    fun setModifierOptionsCursor(rowIndex: Int, columnIndex: Int): Boolean {
        log.debug("Setting modifier options cursor to row: $rowIndex, column: $columnIndex")
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setModifierSelectUiHandlerCursor(${columnIndex}, ${rowIndex})")
                .toString()
        return result.toBoolean()
    }

    fun setPartyCursor(index: Int): Boolean {
        log.debug("Setting party cursor to index: $index")
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setPartyUiHandlerCursor(${index})")
                .toString()
        return result.toBoolean()
    }

    fun setPokeBallCursor(index: Int): Boolean {
        log.debug("Setting pokeball cursor to index: $index")
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setBallUiHandlerCursor(${index})")
                .toString()
        return result.toBoolean()
    }

    fun setPokemonSelectCursor(speciesId: Int): Boolean {
        log.debug("Setting pokemon select cursor to speciesId: $speciesId")
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setStarterSelectUiHandlerCursor(${speciesId});")
                .toString()
        return result.toBoolean()
    }

    fun confirmPokemonSelect(): Boolean {
        log.debug("Confirming pokemon select")
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.confirmStarterSelect();").toString()
        return result.toBoolean()
    }

    fun saveAndQuit(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.saveAndQuit();").toString().toBoolean()
    }

    fun setCursorToLoadGame(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToLoadGame();")
            .toString().toBoolean()
    }

    fun setCursorToNewGame(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setTitleUiHandlerCursorToNewGame();")
            .toString().toBoolean()
    }

    fun getSaveSlots(): Array<SaveSlotDto> {
        val result = jsClient.executeCommandAndGetResult("return window.poru.uihandler.getSaveSlotsJson();").toString()
        return GSON.fromJson(result, Array<SaveSlotDto>::class.java)
    }

    fun submitUserData(): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.pressLoginButton();").toString()
            .toBoolean()
    }

    fun getPokemonInLearnMove(): Pokemon {
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.getPokemonInLearnMovePhaseJson();")
                .toString()
        return GSON.fromJson(result, Pokemon::class.java)
    }

    fun setLearnMoveCursor(moveIndexToReplace: Int): Boolean {
        return jsClient.executeCommandAndGetResult("return window.poru.uihandler.setLearnMoveCursor(${moveIndexToReplace});")
            .toString().toBoolean()
    }

    fun getUiHandler(index: Int): UiHandler {
        val json =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.getUiHandlerJson(${index});").toString()
        val uiHandler = GSON.fromJson(json, UiHandler::class.java)
        return uiHandler
    }

    fun setCursorToIndex(handlerIndex: Int, handlerName: String, indexToSetCursorTo: Int): Boolean {
        val handler = getUiHandler(handlerIndex)
        if (!handler.active) {
            throw IllegalArgumentException("Handler $handlerName is not active")
        }
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setUiHandlerCursor(${handlerIndex}, \"${handlerName}\", ${indexToSetCursorTo});")
                .toString().toBoolean()
        return result
    }

    fun setCursorToIndex(phaseUiTemplate: PhaseUiTemplate, indexToSetCursorTo: Int): Boolean {
        return setCursorToIndex(phaseUiTemplate.handlerIndex, phaseUiTemplate.handlerName, indexToSetCursorTo)
    }
}