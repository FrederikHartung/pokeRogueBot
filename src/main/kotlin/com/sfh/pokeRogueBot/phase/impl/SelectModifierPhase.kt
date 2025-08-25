package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectModifierPhase(
    private val brain: Brain,
    private val jsUiService: JsUiService,
    private val waitingService: WaitingService
) : UiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(SelectModifierPhase::class.java)
    }

    override val phaseName = "SelectModifierPhase"
    var pokemonIndexToSwitchTo =
        -1 // is set with a new value in "UiMode.MODIFIER_SELECT" and then used in "UiMode.PARTY"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.MODIFIER_SELECT -> {
                waitingService.waitLonger() //wait for render
                val result = brain.getModifierToPick()
                if (result == null) {
                    // cant choose item, so don't pick any
                    jsUiService.sendCancelButton()
                    waitingService.waitModifierCursor()
                    jsUiService.setUiHandlerCursor(uiMode, 0)
                    jsUiService.sendActionButton()
                    return
                }
                pokemonIndexToSwitchTo = result.pokemonIndexToSwitchTo // store the pokemon index to switch to

                val isSettingCursorSuccessful =
                    jsUiService.setModifierOptionsCursor(result.rowIndex, result.columnIndex)
                if (!isSettingCursorSuccessful) {
                    throw IllegalStateException("Could not set cursor to modifier option")
                }

                log.debug("moved cursor to row: ${result.rowIndex}, column: ${result.columnIndex}")
                waitingService.waitModifierCursor()
                jsUiService.sendActionButton()
                return
            }

            UiMode.PARTY -> {
                //move to pokemon to apply
                jsUiService.setUiHandlerCursor(uiMode, pokemonIndexToSwitchTo)
                waitingService.waitModifierCursor()
                jsUiService.sendActionButton()
                //apply choice
                jsUiService.sendActionButton()
                return
            }

            else -> throw UnsupportedUiModeException(uiMode)
        }
    }
}