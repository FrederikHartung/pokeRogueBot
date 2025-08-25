package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException

interface Phase {
    val phaseName: String

    @Throws(UnsupportedUiModeException::class)
    fun handleUiMode(uiMode: UiMode)
}

interface UiPhase : Phase

interface NoUiPhase : Phase

interface CustomPhase : Phase