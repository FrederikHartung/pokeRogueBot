package com.sfh.pokeRogueBot.bot

import com.sfh.pokeRogueBot.model.run.RunProperty
import com.sfh.pokeRogueBot.phase.PhaseProcessor
import com.sfh.pokeRogueBot.phase.PhaseProvider
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.WaitingService
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import io.mockk.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class WaveRunnerTestKt {

    private lateinit var waveRunner: WaveRunner
    private lateinit var jsService: JsService
    private lateinit var jsUiService: JsUiService
    private lateinit var phaseProcessor: PhaseProcessor
    private lateinit var brain: Brain
    private lateinit var phaseProvider: PhaseProvider
    private lateinit var waitingService: WaitingService

    val runProperty = RunProperty(1)

    @BeforeEach
    fun setup() {
        jsService = mockk()
        jsUiService = mockk()
        phaseProcessor = mockk()
        brain = mockk()
        phaseProvider = mockk()
        waitingService = mockk()
        waveRunner = WaveRunner(
            jsService,
            jsUiService,
            phaseProcessor,
            brain,
            phaseProvider,
            waitingService,
            true
        )

        every { waitingService.waitForNotActiveWaveRunner() } just Runs

        every { jsService.isUiHandlerActive() } returns true
    }

    /**
     * if the waveRunner is not active, the waitingService should wait
     * and no interaction with the jsService should happen
     */
    @Test
    fun `when the runner is not active, waitingServicesleep should be called`() {
        waveRunner = WaveRunner(
            jsService,
            jsUiService,
            phaseProcessor,
            brain,
            phaseProvider,
            waitingService,
            false
        )

        waveRunner.handlePhaseInWave(runProperty)
        verify { waitingService.waitForNotActiveWaveRunner() }
        verify(exactly = 0) { jsService.isUiHandlerActive() }
    }

    @Test
    fun `when the uiHandler is not active, the waitingService waits and the waveRunner returns`() {
        every { jsService.isUiHandlerActive() } returns false

        waveRunner.handlePhaseInWave(runProperty)

        verify { waitingService.waitBriefly() }
        verify(exactly = 0) { jsService.getCurrentPhaseAsString() }
    }
}