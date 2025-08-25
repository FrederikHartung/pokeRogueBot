package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectStarterPhase(
    private val jsService: JsService,
    private val jsUiService: JsUiService,
    private val brain: Brain,
    private val waitingService: WaitingService,
) : UiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(SelectStarterPhase::class.java)
    }

    override val phaseName = "SelectStarterPhase"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.STARTER_SELECT -> {
                val numberOfSelectedStarters = jsService.getNumberOfSelectedStarters()
                when (numberOfSelectedStarters) {
                    0 -> {
                        jsUiService.setUiHandlerCursor(uiMode, 0)
                        waitingService.waitBriefly()
                        jsUiService.sendActionButton()
                    }

                    1 -> {
                        jsUiService.setUiHandlerCursor(uiMode, 1)
                        waitingService.waitBriefly()
                        jsUiService.sendActionButton()
                    }

                    2 -> {
                        jsUiService.setUiHandlerCursor(uiMode, 2)
                        waitingService.waitBriefly()
                        jsUiService.sendActionButton()
                    }
                    3 -> {
                        jsUiService.confirmPokemonSelect()
                        waitingService.waitBriefly()
                    }
                }

                jsUiService.sendActionButton()
            }

            UiMode.OPTION_SELECT -> {
                jsUiService.sendActionButton()
            }

            UiMode.CONFIRM -> {
                jsUiService.sendActionButton()
            }

            UiMode.SAVE_SLOT -> {
                val runProperty: RunProperty = brain.runProperty
                log.debug("Setting Cursor to saveSlotIndex: {}", runProperty.saveSlotIndex)
                jsUiService.setUiHandlerCursor(uiMode, runProperty.saveSlotIndex)
                waitingService.waitBriefly()
                jsUiService.sendActionButton()
                //jsUiService.setCursorToIndexAndConfirm(template, runProperty.saveSlotIndex)
            }

            else -> throw UiModeException(uiMode)
        }
    }
}