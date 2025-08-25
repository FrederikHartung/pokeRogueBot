package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class AttemptCapturePhase(
    private val jsUiService: JsUiService
) : UiPhase {

    override val phaseName = "AttemptCapturePhase"

    override fun handleUiMode(uiMode: UiMode) {
        if (uiMode == UiMode.CONFIRM) { // todo: release the pokemon with the lowest level
            jsUiService.setUiHandlerCursor(uiMode, 3) // set to no
            jsUiService.sendActionButton()
        } else {
            throw UiModeException(uiMode)
        }
    }
}