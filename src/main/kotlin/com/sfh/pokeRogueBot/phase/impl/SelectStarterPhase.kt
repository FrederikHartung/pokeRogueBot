package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectStarterPhase(
    private val jsService: JsService,
    private val jsUiService: JsUiService,
    private val brain: Brain,
) : AbstractPhase(), UiPhase {

    companion object {
        const val NAME = "SelectStarterPhase"
        private val log = LoggerFactory.getLogger(SelectStarterPhase::class.java)
    }

    override val phaseName: String
        get() = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        val template = getPhaseUiTemplateForUiMode(uiMode)
        when (uiMode) {
            UiMode.STARTER_SELECT -> {
                val numberOfSelectedStarters = jsService.getNumberOfSelectedStarters()
                when (numberOfSelectedStarters) {
                    0 -> jsUiService.setCursorToIndex(template, 0)
                    1 -> jsUiService.setCursorToIndex(template, 1)
                    2 -> jsUiService.setCursorToIndex(template, 2)
                    3 -> {
                        jsUiService.confirmPokemonSelect()
                        return arrayOf(this.waitBriefly)
                    }
                }

                return arrayOf(
                    this.pressSpace
                )
            }

            UiMode.OPTION_SELECT -> {
                return arrayOf(
                    this.pressSpace
                )
            }

            UiMode.CONFIRM -> {
                return arrayOf(
                    this.pressSpace
                )
            }

            UiMode.SAVE_SLOT -> {
                val runProperty: RunProperty = brain.runProperty
                log.debug("Setting Cursor to saveSlotIndex: {}", runProperty.saveSlotIndex)
                val setSaveSlotCursorSuccess = jsUiService.setCursorToIndex(template, runProperty.saveSlotIndex)
                if (setSaveSlotCursorSuccess) {
                    return arrayOf(
                        this.pressSpace, // choose
                        this.waitBriefly,
                        this.pressSpace // confirm
                    )
                }

                throw IllegalStateException("Failed to set cursor to save slot: ${runProperty.saveSlotIndex}")
            }

            else -> throw ActionUiModeNotSupportedException(uiMode, phaseName)
        }
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return when (uiMode) {
            UiMode.STARTER_SELECT -> PhaseUiTemplates.starterSelectWithStarterSelect
            UiMode.OPTION_SELECT -> PhaseUiTemplates.starterSelectWithOptionSelect
            UiMode.CONFIRM -> PhaseUiTemplates.starterSelectWithConfirm
            UiMode.SAVE_SLOT -> PhaseUiTemplates.starterSelectWithSaveSlot
            else -> throw TemplateUiModeNotSupportedException(uiMode, phaseName)
        }
    }
}