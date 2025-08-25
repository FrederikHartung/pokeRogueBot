package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class EvolutionPhase(
    private val jsUiService: JsUiService,
) : UiPhase {
    override val phaseName = "EvolutionPhase"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.EVOLUTION_SCENE -> {
                jsUiService.sendActionButton()
            }

            else -> throw UnsupportedUiModeException(uiMode)
        }
    }
}