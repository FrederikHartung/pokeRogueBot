package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException
import com.sfh.pokeRogueBot.phase.impl.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows

class ShortTermMemoryTest {

    private lateinit var shortTermMemory: ShortTermMemory
    private val memorySize = 50
    private val uniquePhasesThreshold = 3

    @BeforeEach
    fun setUp() {
        shortTermMemory = ShortTermMemory(memorySize, uniquePhasesThreshold)
    }

    @Test
    fun `a loop is detected`() {
        // There is no loop check till the memory is full
        assertDoesNotThrow {
            repeat(memorySize / 2) {
                shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
                shortTermMemory.memorizePhase(SwitchPhase::class.simpleName!!)
            }
        }

        // if the first memory is added when the memory is full, the first check for loop is done
        assertThrows<ActionLoopDetectedException> {
            shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
        }
    }

    @Test
    fun `no loop is detected if different phases are present`() {
        assertDoesNotThrow {
            repeat(memorySize * 2) {
                shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
                shortTermMemory.memorizePhase(SwitchPhase::class.simpleName!!)
                shortTermMemory.memorizePhase(EggHatchPhase::class.simpleName!!)
                shortTermMemory.memorizePhase(CheckSwitchPhase::class.simpleName!!)
                shortTermMemory.memorizePhase(TitlePhase::class.simpleName!!)
            }
        }
    }

    @Test
    fun `no check for loop should happen till the memory is full`() {
        assertDoesNotThrow {
            repeat(memorySize - 1) {
                shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
            }
        }
    }

    @Test
    fun `clearLastPhaseMemory resets the memory`() {
        assertDoesNotThrow {
            repeat(memorySize - 1) {
                shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
            }
        }

        shortTermMemory.clearLastPhaseMemory()

        assertDoesNotThrow {
            repeat(memorySize - 1) {
                shortTermMemory.memorizePhase(CommandPhase::class.simpleName!!)
            }
        }
    }
}