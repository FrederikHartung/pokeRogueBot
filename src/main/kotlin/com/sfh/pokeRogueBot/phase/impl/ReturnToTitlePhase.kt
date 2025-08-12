package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.CustomPhase
import com.sfh.pokeRogueBot.phase.ScreenshotClient
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * There is no ReturnToTitlePhase in the original game. This is a custom phase that is used to return to the title screen after an error.
 */
@Component
class ReturnToTitlePhase(
    private val jsUiService: JsUiService,
    private val screenshotClient: ScreenshotClient
) : AbstractPhase(), CustomPhase {

    companion object {
        const val NAME = "ReturnToTitlePhase"
        private val log = LoggerFactory.getLogger(ReturnToTitlePhase::class.java)
    }

    var lastExceptionType: String = ""

    override val phaseName: String = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return when (uiMode) {
            UiMode.TITLE -> {
                screenshotClient.takeTempScreenshot("error_$lastExceptionType") //take screenshot for debugging
                log.debug("Trying to save and quit")
                val saveAndQuitSuccessful = jsUiService.saveAndQuit()
                if (saveAndQuitSuccessful) {
                    arrayOf(waitEvenLonger) //wait for render
                } else {
                    arrayOf(waitBriefly) //fallback, so no loop happens
                }
            }
            else -> throw NotSupportedException("GameMode is not supported in ReturnToTitlePhase: $uiMode")
        }
    }
}