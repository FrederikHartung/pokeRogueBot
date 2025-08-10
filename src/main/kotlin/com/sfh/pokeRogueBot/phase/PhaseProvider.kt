package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException
import org.springframework.stereotype.Component

@Component
class PhaseProvider(private val phases: Set<Phase>) {

    fun fromString(phaseAsString: String): Phase {
        val phase = phases.find { phase -> phase.phaseName == phaseAsString }
        if(null != phase) {
            return phase
        }
        throw UnsupportedPhaseException(phaseAsString)
    }
}