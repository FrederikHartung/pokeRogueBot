package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.exception.UiValidationFailedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import org.springframework.stereotype.Component

@Component
class UiValidator(private val jsService: JsService) {

    @Throws(UiValidationFailedException::class)
    fun validateOrThrow(phaseUiTemplate: PhaseUiTemplate) {
        return
    }
}