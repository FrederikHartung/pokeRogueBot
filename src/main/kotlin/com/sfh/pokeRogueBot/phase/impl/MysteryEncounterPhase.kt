package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.stereotype.Component

@Component
class MysteryEncounterPhase(private val jsUiService: JsUiService) : UiPhase {
    override val phaseName = "MysteryEncounterPhase"

    override fun handleUiMode(uiMode: UiMode) {
        jsUiService.setUiHandlerCursor(uiMode, 1)
        jsUiService.sendActionButton()
    }
}