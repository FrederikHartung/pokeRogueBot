package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class TitlePhase(
    private val brain: Brain,
    private val jsUiService: JsUiService,
    private val waitingService: WaitingService
) : UiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(TitlePhase::class.java)
    }

    override val phaseName = "TitlePhase"

    @Throws(NotSupportedException::class)
    override fun handleUiMode(uiMode: UiMode) {
        val runProperty = brain.getRunProperty()

        when (uiMode) {
            UiMode.TITLE -> {
                if (runProperty.saveSlotIndex >= 0) {
                    log.debug("found run property with a save slot index, so the current run is lost.")
                    runProperty.status = RunStatus.LOST
                    return
                }

                if (brain.shouldLoadGame()) {
                    log.debug("opening load game screen.")
                    val setCursorToLoadGameSuccessful = jsUiService.setCursorToLoadGame()
                    if (setCursorToLoadGameSuccessful) {
                        waitingService.waitBriefly()
                        jsUiService.sendActionButton()
                        return
                    }
                    throw IllegalStateException("Unable to set cursor to load game.")
                }

                val saveGameSlotIndex = brain.getSaveSlotIndexToSave()
                if (saveGameSlotIndex == -1) {
                    log.warn("No available save slot, closing app.")
                    runProperty.status = RunStatus.EXIT_APP
                    return
                }

                runProperty.saveSlotIndex = saveGameSlotIndex

                val setCursorToNewGameSuccessful = jsUiService.setCursorToNewGame()
                if (setCursorToNewGameSuccessful) {
                    log.debug("Setting cursor to new game.")
                    jsUiService.sendActionButton()
                    return
                }

                throw IllegalStateException("Unable to set cursor to new game.")
            }

            UiMode.SAVE_SLOT -> {
                val saveSlotIndexToLoad = brain.getSaveSlotIndexToLoad()
                if (saveSlotIndexToLoad == -1) {
                    log.debug("No save slot to load, pressing backspace and returning to title.")
                    jsUiService.sendCancelButton()
                    return
                }

                jsUiService.setUiHandlerCursor(uiMode, saveSlotIndexToLoad)
                log.debug("Save slot index to load: $saveSlotIndexToLoad")
                runProperty.saveSlotIndex = saveSlotIndexToLoad
                jsUiService.sendActionButton()
                return
            }

            UiMode.OPTION_SELECT -> {
                jsUiService.setUiHandlerCursor(uiMode, 0) //classic
                jsUiService.sendActionButton()
                return
            }

            else -> throw UnsupportedUiModeException(uiMode)
        }
    }
}