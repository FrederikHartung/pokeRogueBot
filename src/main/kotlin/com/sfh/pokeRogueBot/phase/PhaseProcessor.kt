package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.browser.BrowserClient
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.phase.actions.*
import com.sfh.pokeRogueBot.service.ImageService
import com.sfh.pokeRogueBot.service.WaitingService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class PhaseProcessor(
    private val waitingService: WaitingService,
    private val browserClient: BrowserClient,
    private val imageService: ImageService,
    private val fileManager: FileManager
) : ScreenshotClient {

    private val logger = LoggerFactory.getLogger(PhaseProcessor::class.java)

    /**
     * Handles the given phase by performing the actions in the phase and waits the configured time after the phase.
     */
    @Throws(Exception::class)
    fun handlePhase(phase: Phase, gameMode: UiMode) {
        val actionsToPerform = phase.getActionsForGameMode(gameMode)
        for (action in actionsToPerform) {
            handleAction(action)
        }

        waitingService.waitAfterPhase(phase)
    }

    @Throws(Exception::class)
    private fun handleAction(action: PhaseAction) {
        when (action) {
            is PressKeyPhaseAction -> {
                browserClient.pressKey(action.keyToPress)
            }

            is WaitPhaseAction -> {
                waitingService.waitBriefly()
            }

            is WaitForTextRenderPhaseAction -> {
                waitingService.waitLonger()
            }

            is WaitForStageRenderPhaseAction -> {
                waitingService.waitEvenLonger()
            }

            is TakeScreenshotPhaseAction -> {
                takeTempScreenshot("phase")
            }

            else -> {
                throw NotSupportedException("Unknown action: ${action.javaClass.simpleName}")
            }
        }
    }

    override fun takeTempScreenshot(prefix: String) {
        try {
            fileManager.saveTempImage(imageService.takeScreenshot(prefix), prefix)
        } catch (e: Exception) {
            logger.error("error while taking temp screenshot: ${e.message}")
        }
    }

    override fun persistScreenshot(prefix: String) {
        try {
            fileManager.persistImage(imageService.takeScreenshot(prefix), prefix)
        } catch (e: Exception) {
            logger.error("error while saving screenshot: ${e.message}")
        }
    }
}