package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class SwitchPhase(
    private val brain: Brain,
    private val jsUiService: JsUiService
) : UiPhase {

    private var ignoreFirstPokemon = false

    override val phaseName = "SwitchPhase"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.PARTY -> {
                val switchDecision = brain.getPokemonSwitchDecision(ignoreFirstPokemon) // maybe an own pokemon fainted
                ignoreFirstPokemon = false
                jsUiService.setUiHandlerCursor(uiMode, switchDecision.index)
                jsUiService.sendActionButton()
                //confirm sendout
                jsUiService.sendActionButton()
                return
            }

            else -> throw UnsupportedUiModeException(uiMode)
        }
    }
}