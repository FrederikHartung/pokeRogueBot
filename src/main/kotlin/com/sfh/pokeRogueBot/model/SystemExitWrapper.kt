package com.sfh.pokeRogueBot.model

import org.springframework.stereotype.Component

/**
 * Needed for easier Unit Tests, to add a wrapper around the Static System object
 */
@Component
object SystemExitWrapper {

    fun exit(exitCode: Int) {
        System.exit(exitCode)
    }
}