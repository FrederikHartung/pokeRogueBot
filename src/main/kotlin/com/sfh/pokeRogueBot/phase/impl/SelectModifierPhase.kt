package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SelectModifierPhase(
    private val brain: Brain,
    private val jsUiService: JsUiService,
    private val waitService: WaitingService
) : AbstractPhase(), UiPhase {

    companion object {
        const val NAME = "SelectModifierPhase"
        private val log = LoggerFactory.getLogger(SelectModifierPhase::class.java)
    }

    override val phaseName: String = NAME

    private var pokemonIndexToSwitchTo = -1 // on startup

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        val actionList = mutableListOf<PhaseAction>()

        when (uiMode) {
            UiMode.MODIFIER_SELECT -> {
                waitService.waitEvenLonger() // wait for the modifier shop to render
                waitService.waitLonger()
                val result = brain.getModifierToPick()
                if (result == null) {
                    // cant choose item, so don't pick any
                    return arrayOf(
                        pressBackspace,
                        waitLonger,
                        pressSpace
                    )
                }
                pokemonIndexToSwitchTo = result.pokemonIndexToSwitchTo // store the pokemon index to switch to

                val isSettingCursorSuccessful =
                    jsUiService.setModifierOptionsCursor(result.rowIndex, result.columnIndex)
                if (!isSettingCursorSuccessful) {
                    throw IllegalStateException("Could not set cursor to modifier option")
                }

                log.debug("moved cursor to row: ${result.rowIndex}, column: ${result.columnIndex}")
                waitService.waitEvenLonger() // wait for the cursor to be set

                actionList.add(pressSpace) // to confirm selection -> gamemode will change to party
            }

            UiMode.PARTY -> {
                val isSettingCursorSuccessful = jsUiService.setPartyCursor(pokemonIndexToSwitchTo)
                if (!isSettingCursorSuccessful) {
                    throw IllegalStateException("Could not set cursor to party pokemon")
                }

                actionList.add(waitBriefly)
                actionList.add(pressSpace) // open confirm menu
                actionList.add(waitBriefly) // wait for confirm menu to render
                actionList.add(pressSpace) // confirm the application of the modifier
            }

            UiMode.MESSAGE -> {
                actionList.add(pressSpace)
            }

            UiMode.SUMMARY -> {
                actionList.add(pressBackspace) // go back to team
                actionList.add(waitLonger)
                actionList.add(pressBackspace) // go back to modifier shop
            }

            else -> throw ActionUiModeNotSupportedException(uiMode, phaseName)
        }

        return actionList.toTypedArray()
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return when (uiMode) {
            UiMode.MODIFIER_SELECT -> PhaseUiTemplates.selectModifierWithSelectModifier
            else -> throw TemplateUiModeNotSupportedException(uiMode, phaseName)
        }
    }
}