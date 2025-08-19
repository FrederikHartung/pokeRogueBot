package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

@Component
class MysteryEncounterPhase : AbstractPhase(), UiPhase {
    override val phaseName = "MysteryEncounterPhase"

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return arrayOf(this.pressSpace)
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return PhaseUiTemplates.mysteryEncounter
    }
}