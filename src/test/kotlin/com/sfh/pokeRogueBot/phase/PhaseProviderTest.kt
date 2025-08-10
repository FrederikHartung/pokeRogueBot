package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException
import com.sfh.pokeRogueBot.phase.impl.TitlePhase
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PhaseProviderTest {

    private lateinit var phaseProvider: PhaseProvider
    private lateinit var phases: MutableSet<Phase>

    @BeforeEach
    fun setUp() {
        phases = mutableSetOf()
        phaseProvider = PhaseProvider(phases)
    }

    @Test
    fun `fromString finds and returns a Phase`(){
        val phase = TitlePhase(mockk(), mockk())
        phases.add(phase)

        val result = phaseProvider.fromString(phase.phaseName)
        assertEquals(phase.phaseName, result.phaseName)
    }

    @Test
    fun `fromString throws an UnsupportedPhaseException when a Phase is not found`(){
        assertThrows<UnsupportedPhaseException> { phaseProvider.fromString("dummyPhase") }
    }
}