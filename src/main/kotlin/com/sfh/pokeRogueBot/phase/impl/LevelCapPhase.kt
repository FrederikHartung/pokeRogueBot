package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction

class LevelCapPhase() : AbstractPhase(), NoUiPhase {

    companion object {
        val NAME = "LevelCapPhase"
    }

    override val phaseName = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return arrayOf(this.waitBriefly)
    }
}