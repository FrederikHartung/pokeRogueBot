package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.javascript.JsService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class SelectGenderPhase(
    @Value("\${app.chooseGender}") private val genderToPick: String,
    private val jsService: JsService,
) : AbstractPhase(), UiPhase {

    override fun getPhaseUiTemplate(): PhaseUiTemplate {
        return PhaseUiTemplates.selectGenderPhaseUi
    }

    override val phaseName: String
        get() = "SelectGenderPhase"

    @Throws(NotSupportedException::class)
    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        var indexToSetCursorTo = -1
        getPhaseUiTemplate().configOptionsLabel.forEachIndexed { index, label ->
            if (label == genderToPick) {
                indexToSetCursorTo = index
            }
        }
        if (indexToSetCursorTo == -1) {
            indexToSetCursorTo = 0 //fallback to "Male"
        }
        //jsservice validate handler is active and set cursor

        return arrayOf<PhaseAction>(
            this.pressSpace
        )
    }
}