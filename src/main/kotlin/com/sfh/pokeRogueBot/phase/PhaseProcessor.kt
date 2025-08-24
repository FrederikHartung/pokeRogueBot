package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.service.ImageService
import com.sfh.pokeRogueBot.service.WaitingService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class PhaseProcessor(
    private val waitingService: WaitingService,
    private val imageService: ImageService,
    private val fileManager: FileManager
) : ScreenshotClient {

    companion object {
        private val logger = LoggerFactory.getLogger(PhaseProcessor::class.java)
    }

    /**
     * Handles the given phase by performing the actions in the phase and waits the configured time after the phase.
     */
    @Throws(Exception::class)
    fun handlePhase(phase: Phase, uiMode: UiMode) {
        phase.handleUiMode(uiMode)
        waitingService.waitBriefly()
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