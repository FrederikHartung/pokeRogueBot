package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.Phase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import org.springframework.stereotype.Component

@Component
class MessagePhase : AbstractPhase(), Phase {

    companion object {
        const val NAME = "MessagePhase"
    }

    override val waitAfterStage2x: Int = 100

    override val phaseName: String = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return when (uiMode) {
            UiMode.MESSAGE -> arrayOf(
                pressSpace,
                waitBriefly
            )

            UiMode.COMMAND, UiMode.EGG_HATCH_SCENE, UiMode.MODIFIER_SELECT -> arrayOf(
                waitLonger
            )

            else -> throw NotSupportedException("GameMode not supported for MessagePhase: $uiMode")
        }
    }
}