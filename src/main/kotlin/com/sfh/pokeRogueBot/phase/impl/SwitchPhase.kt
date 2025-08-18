package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.ActionUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.exception.TemplateUiModeNotSupportedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplates
import com.sfh.pokeRogueBot.phase.AbstractPhase
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.phase.actions.PhaseAction
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SwitchPhase(
    private val brain: Brain,
    private val jsUiService: JsUiService
) : AbstractPhase(), UiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(SwitchPhase::class.java)
        val NAME = "SwitchPhase"
    }

    private var ignoreFirstPokemon = false

    override val phaseName = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return when (uiMode) {
            UiMode.PARTY -> { // maybe an own pokemon fainted
                val switchDecision = brain.getPokemonSwitchDecision(ignoreFirstPokemon)
                ignoreFirstPokemon = false
                val switchSuccessful = jsUiService.setPartyCursor(switchDecision.index)

                if (switchSuccessful) {
                    arrayOf(
                        waitBriefly,
                        pressSpace, //choose the pokemon
                        waitBriefly, //render confirm button
                        pressSpace //confirm the switch
                    )
                } else {
                    throw IllegalStateException("Could not set cursor to party pokemon")
                }
            }

            UiMode.MESSAGE -> {
                arrayOf(waitBriefly)
            }

            UiMode.SUMMARY -> {
                ignoreFirstPokemon = true
                arrayOf(
                    waitBriefly,
                    pressBackspace
                )
            }

            else -> throw ActionUiModeNotSupportedException(uiMode, phaseName)
        }
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        when (uiMode) {
            UiMode.PARTY -> return PhaseUiTemplates.switchPhaseWithParty
            else -> throw TemplateUiModeNotSupportedException(uiMode, phaseName)
        }
    }
}