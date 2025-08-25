package com.sfh.pokeRogueBot.bot

import com.sfh.pokeRogueBot.model.enums.RunStatus
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.phase.PhaseProcessor
import com.sfh.pokeRogueBot.phase.PhaseProvider
import com.sfh.pokeRogueBot.phase.impl.TitlePhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.openqa.selenium.JavascriptException
import org.openqa.selenium.NoSuchWindowException
import org.openqa.selenium.remote.UnreachableBrowserException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class WaveRunner(
    private val jsService: JsService,
    private val jsUiService: JsUiService,
    private val phaseProcessor: PhaseProcessor,
    private val brain: Brain,
    private val phaseProvider: PhaseProvider,
    private val waitingService: WaitingService,
    @Value("\${bot.startBotOnStartup}") startBotOnStartup: Boolean
) {

    companion object {
        const val WAIT_TIME_IF_WAVE_RUNNER_IS_NOT_ACTIVE = 10000
        private val log = LoggerFactory.getLogger(WaveRunner::class.java)
    }

    var isActive: Boolean = startBotOnStartup

    fun handlePhaseInWave(runProperty: RunProperty) {
        if (!isActive) {
            log.debug("WaveRunner is not active, skipping phase handling")
            waitingService.waitForNotActiveWaveRunner()
            return
        }

        try {
            val isUiHandlerActive = jsService.isUiHandlerActive()
            if (!isUiHandlerActive) {
                waitingService.waitBriefly()
                log.debug("uiHandlerActive is not active, skipping phase handling and wait for render")
                return
            }

            val phaseAsString = jsService.getCurrentPhaseAsString()
            val phase = phaseProvider.fromString(phaseAsString)
            val uiMode = jsService.getUiMode()
            if (uiMode == UiMode.MESSAGE) {
                log.debug("uimode is message")
                brain.memorize(phase.phaseName)
                jsUiService.triggerMessageAdvance()
                waitingService.waitBriefly()
                return
            }

            if (!(brain.phaseUiIsValidated(phase, uiMode))) {
                log.warn("Phase ${phaseAsString} is not validated, waiting...")
                waitingService.waitLonger()
                brain.memorize(phase.phaseName)
                return
            }

            log.debug("phase detected: {}, uiMode: {}", phase.phaseName, uiMode)
            phaseProcessor.handlePhase(phase, uiMode)
            brain.memorize(phase.phaseName)
        } catch (e: Exception) {
            when (e) {
                is JavascriptException -> {
                    //logging of the exception happends in the ChromeBrowserClient
                    System.exit(1)
                }

                is NoSuchWindowException, is UnreachableBrowserException -> {
                    log.warn("Unexpected error, quitting app: ${e.message}")
                    System.exit(1)
                }
                else -> {
                    log.error("Error in WaveRunner, trying to save and quit to title, error: ${e.message}", e)
                    runProperty.status = RunStatus.ERROR
                    saveAndQuit(runProperty, e.javaClass.simpleName)
                }
            }
        }
    }

    /**
     * if save and quit is executed, the title menu should be reached.
     * if not, the app should be reloaded
     *
     * @param runProperty       to set the runstatus to reload app if needed
     * @param lastExceptionType the last exception type that occurred
     */
    fun saveAndQuit(runProperty: RunProperty, lastExceptionType: String) {
        try {
            phaseProcessor.takeTempScreenshot("error_$lastExceptionType")
            log.debug("Trying to save and quit")
            jsUiService.saveAndQuit()

            waitingService.waitLonger() // wait for render title
            val phaseAsString = jsService.getCurrentPhaseAsString()
            if (phaseAsString == TitlePhase::class.simpleName) {
                log.debug("we are in title phase, saving and quitting worked")
                return
            } else {
                log.error("unable to save and quit, we are not in title phase")
            }
        } catch (e: Exception) {
            if(e.message?.startsWith("no such window: target window already closed") == true) {
                log.warn("unable to save and quit: no such window: target window already closed")
            }
            else{
                log.error("unable to save and quit: ${e.message}")
            }
        }

        runProperty.status = RunStatus.RELOAD_APP
    }
}