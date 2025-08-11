package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.exception.UiValidationFailedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import org.springframework.stereotype.Component

@Component
class UiValidator(private val jsService: JsService) {

    @Throws(UiValidationFailedException::class)
    fun validateOrThrow(phaseUiTemplate: PhaseUiTemplate, phaseName: String) {
        val uiHandler = jsService.getUiHandler(phaseUiTemplate.handlerIndex)
        if (uiHandler.index != phaseUiTemplate.handlerIndex) {
            throw UiValidationFailedException("uiHandler.index '${uiHandler.index}' does not match phaseUiTemplate.handlerIndex '${phaseUiTemplate.handlerIndex}' for handler ${phaseUiTemplate.handlerIndex} in phase $phaseName")
        }
        if (uiHandler.name != phaseUiTemplate.handlerName) {
            throw UiValidationFailedException("uiHandler.name '${uiHandler.name}' does not match phaseUiTemplate.handlerName '${phaseUiTemplate.handlerName}' in phase $phaseName")
        }
        if (uiHandler.configOptionsSize != phaseUiTemplate.configOptionsLabel.size) {
            throw UiValidationFailedException("uiHandler.configOptionsSize '${uiHandler.configOptionsSize}' does not match phaseUiTemplate.configOptionsLabel.size '${phaseUiTemplate.configOptionsLabel.size}' in phase $phaseName")
        }
        if (!configOptionsAreMatching(phaseUiTemplate.configOptionsLabel, uiHandler.configOptionsLabel)) {
            throw UiValidationFailedException("uiHandler.configOptionsLabel '${uiHandler.configOptionsLabel}' does not match phaseUiTemplate.configOptionsLabel '${phaseUiTemplate.configOptionsLabel}' in phase $phaseName")
        }
    }

    private fun configOptionsAreMatching(templateOptions: List<String>, handlerOptions: List<String>): Boolean {
        return templateOptions == handlerOptions
    }
}