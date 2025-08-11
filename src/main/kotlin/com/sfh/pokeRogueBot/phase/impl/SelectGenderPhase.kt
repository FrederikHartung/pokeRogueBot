package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

@Component
class SelectGenderPhase : AbstractPhase(), UiPhase {

    override fun getPhaseUiTemplate(): PhaseUiTemplate {
        return PhaseUiTemplates.selectGenderPhaseUi
    }

    override val phaseName: String
        get() = "SelectGenderPhase"

    @Throws(NotSupportedException::class)
    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return arrayOf<PhaseAction>(
            this.pressSpace
        )
    }
}