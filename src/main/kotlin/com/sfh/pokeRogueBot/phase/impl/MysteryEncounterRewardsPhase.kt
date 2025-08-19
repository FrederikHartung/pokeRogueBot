package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

@Component
class MysteryEncounterRewardsPhase: AbstractPhase(), UiPhase {
    override val phaseName = "MysteryEncounterRewardsPhase"

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        TODO("Not yet implemented")
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return PhaseUiTemplates.mysteryEncounterRewardWithOptionSelect
    }
}