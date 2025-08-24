package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class SelectGenderPhase(
    @Value("\${app.game.chooseGender}") private val genderToPick: String,
    private val jsUiService: JsUiService,
) : UiPhase {
    override val phaseName = "SelectGenderPhase"

    companion object {
        val BOY = "BOY"
    }

    @Throws(NotSupportedException::class)
    override fun handleUiMode(uiMode: UiMode) {
        val indexToSetCursorTo = if (BOY.equals(genderToPick)) 0 else 1
        jsUiService.setUiHandlerCursor(uiMode, indexToSetCursorTo)
        jsUiService.sendActionButton()
    }
}