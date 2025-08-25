package com.sfh.pokeRogueBot.service.javascript

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.browser.JsClient
import com.sfh.pokeRogueBot.model.browser.gamejson.Button
import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandlerDto
import com.sfh.pokeRogueBot.model.dto.SaveSlotDto
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiHandlerNotActiveException
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItemDeserializer
import com.sfh.pokeRogueBot.model.modifier.ModifierShop
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.ui.UiHandlerService
import com.sfh.pokeRogueBot.model.ui.UiHandlerTemplate
import com.sfh.pokeRogueBot.service.WaitingService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class JsUiService(
    private val jsClient: JsClient,
    private val uiHandlerService: UiHandlerService,
    private val waitingService: WaitingService,
) {

    companion object {
        private val log = LoggerFactory.getLogger(JsUiService::class.java)
    }

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

    fun getUiHandlerDto(index: Int): UiHandlerDto {
        val json =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.getUiHandlerDtoJson(${index});")
                .toString()
        val uiHandlerDto = GSON.fromJson(json, UiHandlerDto::class.java)
        return uiHandlerDto
    }

    fun setCursorToIndex(handlerDto: UiHandlerDto, indexToSetCursorTo: Int): Boolean {
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setUiHandlerCursor(${handlerDto.index}, ${indexToSetCursorTo});")
                .toString().toBoolean()
        return result
    }


    fun setCursorToIndex(handlerIndex: Int, handlerName: String, indexToSetCursorTo: Int): Boolean {
        val handler = getUiHandlerDto(handlerIndex)
        if (!handler.active) {
            throw IllegalStateException("Handler $handlerName is not active")
        }
        return setCursorToIndex(handler, indexToSetCursorTo)
    }

    fun setCursorToIndex(uiHandlerTemplate: UiHandlerTemplate, indexToSetCursorTo: Int): Boolean {
        return setCursorToIndex(uiHandlerTemplate.handlerIndex, uiHandlerTemplate.handlerName, indexToSetCursorTo)
    }

    fun setCursorToIndexAndConfirm(
        uiHandlerTemplate: UiHandlerTemplate,
        indexToSetCursorTo: Int,
        waitTimeForRenderMs: Int = 0
    ): Boolean {
        val handler = getUiHandlerDto(uiHandlerTemplate.handlerIndex)
        if (!handler.active) {
            throw IllegalStateException("Handler ${uiHandlerTemplate.handlerName} is not active")
        }
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.setCursorToIndexAndConfirm(${uiHandlerTemplate.handlerIndex}, \"${uiHandlerTemplate.handlerName}\", ${indexToSetCursorTo}, ${waitTimeForRenderMs});")
                .toString().toBoolean()
        return result
    }

    fun triggerMessageAdvance(relaxed: Boolean = false) {
        jsClient.executeCommandAndGetResult("return window.poru.uihandler.triggerMessageAdvance($relaxed);").toString()
            .toBoolean()
        waitingService.waitBriefly()
    }

    fun sendCancelButton() {
        jsClient.executeCommandAndGetResult("return window.poru.uihandler.sendButton(${Button.CANCEL});").toString()
            .toBoolean()
        waitingService.waitBriefly()
    }

    fun sendActionButton(): Boolean {
        val result =
            jsClient.executeCommandAndGetResult("return window.poru.uihandler.sendButton(${Button.ACTION});").toString()
            .toBoolean()
        waitingService.waitBriefly()
        return result
    }

    /**
     * Validates correct UiHandler for UiMode is active and used for setting the cursor index
     * Uses the waiting service to wait after setting the cursor to the new index
     * Returns true, when the index was set correctly
     * Returns false, when relaxedForInActiveHandler is true and the uiHandler was not active
     */
    fun setUiHandlerCursor(
        uiMode: UiMode,
        newIndex: Int,
        relaxedForInActiveHandler: Boolean = false,
    ): Boolean {
        val handlerTemplate = uiHandlerService.getHandlerForUiMode(uiMode)
        val handlerDto = getUiHandlerDto(handlerTemplate.handlerIndex)
        try {
            uiHandlerService.validateHandlerDtoOrThrow(handlerTemplate, handlerDto)
        } catch (e: UiHandlerNotActiveException) {
            if (relaxedForInActiveHandler) {
                //for some uiHandler it is possible, that they are not always active
                //example: TargetSelect for Teamfights with only one Pokemon
                return false
            }
        }
        setCursorToIndex(handlerDto, newIndex)
        waitingService.waitBriefly()
        return true
    }
}