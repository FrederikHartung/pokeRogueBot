package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.NoUiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

@Component
class ShowAbilityPhase : AbstractPhase(), NoUiPhase {
    override val phaseName = "ShowAbilityPhase"

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return arrayOf(this.waitBriefly)
    }
}