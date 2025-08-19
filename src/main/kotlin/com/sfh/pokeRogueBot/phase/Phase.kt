package com.sfh.pokeRogueBot.phase

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.phase.actions.PhaseAction

interface Phase {
    val waitAfterStage2x: Int
    val phaseName: String

    @Throws(ActionUiModeNotSupportedException::class)
    fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction>
}

interface UiPhase : Phase {
    @Throws(TemplateUiModeNotSupportedException::class)
    fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate
}

interface NoUiPhase : Phase

interface CustomPhase : Phase