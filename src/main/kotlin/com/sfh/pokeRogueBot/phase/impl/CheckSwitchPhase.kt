package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class CheckSwitchPhase(
    private val brain: Brain,
    private val jsUiService: JsUiService
) : UiPhase {

    override val phaseName: String = "CheckSwitchPhase"

    override fun handleUiMode(uiMode: UiMode) {
        if (uiMode == UiMode.CONFIRM) {
            val shouldSwitchPokemon = brain.shouldSwitchPokemon()

            if (shouldSwitchPokemon) {
                jsUiService.sendActionButton()
                return
            } else {
                jsUiService.setUiHandlerCursor(uiMode, 1) //set to no
                jsUiService.sendActionButton()
                return
            }
        }

        throw UiModeException(uiMode)
    }
}