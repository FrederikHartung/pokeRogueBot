package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class TitlePhase(
    private val brain: Brain,
    private val jsUiService: JsUiService
) : AbstractPhase(), UiPhase {

    companion object {
        const val NAME = "TitlePhase"
        private val log = LoggerFactory.getLogger(TitlePhase::class.java)
    }

    override val phaseName = NAME

    @Throws(NotSupportedException::class)
    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        val runProperty = brain.runProperty
            ?: throw IllegalStateException("RunProperty is null in TitlePhase")

        val template = getPhaseUiTemplateForUiMode(uiMode)

        when (uiMode) {
            UiMode.TITLE -> {
                if (runProperty.saveSlotIndex >= 0) {
                    log.debug("found run property with a save slot index, so the current run is lost.")
                    runProperty.status = RunStatus.LOST
                    return arrayOf(waitBriefly)
                }

                if (brain.shouldLoadGame()) {
                    log.debug("opening load game screen.")
                    val setCursorToLoadGameSuccessful = jsUiService.setCursorToLoadGame()
                    if (setCursorToLoadGameSuccessful) {
                        return arrayOf(pressSpace)
                    }
                    throw IllegalStateException("Unable to set cursor to load game.")
                }

                val saveGameSlotIndex = brain.saveSlotIndexToSave
                if (saveGameSlotIndex == -1) {
                    log.warn("No available save slot, closing app.")
                    runProperty.status = RunStatus.EXIT_APP
                    return arrayOf(waitBriefly)
                }

                runProperty.saveSlotIndex = saveGameSlotIndex

                val setCursorToNewGameSuccessful = jsUiService.setCursorToNewGame()
                if (setCursorToNewGameSuccessful) {
                    log.debug("Setting cursor to new game.")
                    return arrayOf(pressSpace)
                }

                throw IllegalStateException("Unable to set cursor to new game.")
            }

            UiMode.SAVE_SLOT -> {
                val saveSlotIndexToLoad = brain.saveSlotIndexToLoad
                if (saveSlotIndexToLoad == -1) {
                    log.debug("No save slot to load, pressing backspace and returning to title.")
                    return arrayOf(pressBackspace)
                }

                val setCursorToSaveSlotSuccessful = jsUiService.setCursorToIndex(
                    template.handlerIndex,
                    template.handlerName,
                    saveSlotIndexToLoad // Load Game
                )
                if (setCursorToSaveSlotSuccessful) {
                    log.debug("Save slot index to load: $saveSlotIndexToLoad")
                    runProperty.saveSlotIndex = saveSlotIndexToLoad
                    return arrayOf(pressSpace, waitEvenLonger)
                }

                throw IllegalStateException("Unable to set cursor to save slot.")
            }

            UiMode.MESSAGE -> {
                jsUiService.triggerMessageAdvance()
                return arrayOf(waitBriefly)
            }

            UiMode.OPTION_SELECT -> {
                val setCursorToClassicSuccessful = jsUiService.setCursorToIndex(
                    template.handlerIndex,
                    template.handlerName,
                    0 // Classic
                )
                if (!setCursorToClassicSuccessful) {
                    throw IllegalStateException("Unable to set cursor to classic GameMode")
                }
                return arrayOf(pressSpace)
            }

            else -> throw ActionUiModeNotSupportedException(uiMode, phaseName)
        }
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return when (uiMode) {
            UiMode.TITLE -> PhaseUiTemplates.titlePhaseWithTitle
            UiMode.OPTION_SELECT -> PhaseUiTemplates.titlePhaseWithOptionSelect
            UiMode.SAVE_SLOT -> PhaseUiTemplates.titlePhaseWithSaveSlot
            else -> throw TemplateUiModeNotSupportedException(uiMode, phaseName)
        }
    }
}