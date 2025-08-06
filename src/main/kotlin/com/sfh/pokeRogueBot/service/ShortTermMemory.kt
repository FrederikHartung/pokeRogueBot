package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.exception.ActionLoopDetectedException
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.*

/**
 * ShortTermMemory is used to store the last actions of the bot in the current application run.
 * It helps to detect action loops by checking if the same actions are repeated too often.
 */
@Component
class ShortTermMemory(
    @Value("\${brain.shortTermMemory.memorySize}") private val memorySize: Int,
    @Value("\${brain.shortTermMemory.minPhasesForLoop}") private val minPhasesForLoop: Int
) {

    private val lastMemories: MutableList<String> = LinkedList()

    fun memorizePhase(memory: String) {
        if (lastMemories.size < memorySize) {
            lastMemories.add(memory)
        } else {
            checkForActionLoop()
            lastMemories.removeFirst()
            lastMemories.add(memory)
        }
    }

    fun clearMemory() {
        lastMemories.clear()
    }

    private fun checkForActionLoop() {
        val phaseCount = mutableMapOf<String, Int>()

        for (i in 0 until memorySize) {
            val phase = lastMemories[i]
            phaseCount[phase] = phaseCount.getOrDefault(phase, 0) + 1
        }

        if (phaseCount.size < minPhasesForLoop) {
            val phaseCountString = phaseCount.entries.joinToString(", ") { "${it.key}: ${it.value}" }
            throw ActionLoopDetectedException("Action loop detected: $phaseCountString")
        }
    }
}