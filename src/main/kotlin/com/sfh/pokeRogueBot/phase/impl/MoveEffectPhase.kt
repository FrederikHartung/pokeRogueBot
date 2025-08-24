package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class MoveEffectPhase(private val brain: Brain, private val jsUiService: JsUiService) : UiPhase {

    override val phaseName: String = "MoveEffectPhase"

    override fun handleUiMode(uiMode: UiMode) {
        if (uiMode == UiMode.PARTY) {
            val switchDecision = brain.getBestSwitchDecision()

            jsUiService.setUiHandlerCursor(uiMode, switchDecision.index)
            jsUiService.sendActionButton()
        }

        //todo: acc handling for uimode option

        throw UiModeException(uiMode)
    }
}