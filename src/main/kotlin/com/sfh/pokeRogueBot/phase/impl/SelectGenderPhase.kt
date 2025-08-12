package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class SelectGenderPhase(
    @Value("\${app.chooseGender}") private val genderToPick: String,
    private val jsUiService: JsUiService,
) : AbstractPhase(), UiPhase {

    override fun getPhaseUiTemplate(): PhaseUiTemplate {
        return PhaseUiTemplates.selectGenderPhaseUi
    }

    override val phaseName: String
        get() = "SelectGenderPhase"

    @Throws(NotSupportedException::class)
    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        val template = getPhaseUiTemplate()
        var indexToSetCursorTo = -1
        template.configOptionsLabel.forEachIndexed { index, label ->
            if (label == genderToPick) {
                indexToSetCursorTo = index
            }
        }
        if (indexToSetCursorTo == -1) {
            indexToSetCursorTo = 0 //fallback to "Male"
        }

        val handler = jsUiService.getUiHandler(getPhaseUiTemplate().handlerIndex)
        if (!handler.active) { //wait till render or till loop detection throws
            return arrayOf<PhaseAction>(
                this.waitBriefly
            )
        }
        val success = jsUiService.setCursorToIndex(template.handlerIndex, template.handlerName, indexToSetCursorTo)
        if (!success) {
            throw IllegalStateException("Can't set cursor to index $indexToSetCursorTo in SelectGenderPhase")
        }

        return arrayOf<PhaseAction>(
            this.pressSpace
        )
    }
}