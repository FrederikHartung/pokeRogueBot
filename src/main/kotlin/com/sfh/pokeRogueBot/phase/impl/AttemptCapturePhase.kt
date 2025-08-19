package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class AttemptCapturePhase(
    private val jsUiService: JsUiService
) : AbstractPhase(), UiPhase {

    companion object {
        const val NAME = "AttemptCapturePhase"
    }

    override val phaseName: String = NAME

    override val waitAfterStage2x: Int = 1000

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        if (uiMode == UiMode.CONFIRM) { // todo: release the pokemon with the lowest level
            val template = getPhaseUiTemplateForUiMode(UiMode.CONFIRM)
            jsUiService.setCursorToIndex(template, 3) // set to no

            return arrayOf( // don't take captured wild pokemons
                waitBriefly,
                pressSpace
            )
        }

        throw ActionUiModeNotSupportedException(uiMode, NAME)
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return when (uiMode) {
            UiMode.CONFIRM -> PhaseUiTemplates.attemptCaptureWithConfirm
            else -> throw TemplateUiModeNotSupportedException(uiMode, NAME)
        }
    }
}