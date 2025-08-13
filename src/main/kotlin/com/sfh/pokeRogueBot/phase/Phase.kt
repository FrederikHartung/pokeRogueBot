package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.phase.actions.PhaseAction

interface Phase {
    val waitAfterStage2x: Int
    val phaseName: String

    @Throws(NotSupportedException::class)
    fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction>
}

interface UiPhase : Phase {
    fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate
}

interface NoUiPhase : Phase

interface CustomPhase : Phase