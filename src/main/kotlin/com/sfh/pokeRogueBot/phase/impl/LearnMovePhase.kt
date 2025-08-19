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
class LearnMovePhase(
    private val jsUiService: JsUiService,
    private val brain: Brain
) : AbstractPhase(), UiPhase {

    companion object {
        const val NAME = "LearnMovePhase"
        private val log = LoggerFactory.getLogger(LearnMovePhase::class.java)
    }

    override val phaseName: String = NAME

    override fun getActionsForUiMode(uiMode: UiMode): Array<PhaseAction> {
        return when (uiMode) {
            UiMode.MESSAGE -> arrayOf(
                pressSpace,
                waitBriefly
            )

            UiMode.CONFIRM -> arrayOf(
                // should pokemon learn message
                pressSpace // enter summary screen
            )

            UiMode.EVOLUTION_SCENE -> arrayOf(
                waitBriefly,
                pressSpace
            )

            UiMode.SUMMARY -> handleLearnMove()

            else -> throw ActionUiModeNotSupportedException(uiMode, phaseName)
        }
    }

    override val waitAfterStage2x: Int = 500

    private fun handleLearnMove(): Array<PhaseAction> {
        val pokemon = jsUiService.getPokemonInLearnMove()

        val moveset = pokemon.moveset ?: throw IllegalStateException("Pokemon moveset is null")
        val message = "Pokemon ${pokemon.name} wants to learn move: ${moveset[moveset.size - 1].name}"
        log.debug(message)
        brain.memorize(message)

        val learnMoveDecision = brain.getLearnMoveDecision(pokemon)
            ?: throw IllegalStateException("No learn move decision found for pokemon: ${pokemon.name}")

        return if (learnMoveDecision.isNewMoveBetter) {
            val cursorMoved = jsUiService.setLearnMoveCursor(learnMoveDecision.moveIndexToReplace)
            if (!cursorMoved) {
                throw IllegalStateException("Failed to move cursor to learn move")
            }

            arrayOf(
                waitLonger,
                pressSpace
            )
        } else {
            arrayOf(
                pressBackspace, // don't learn move
                waitLonger,
                pressSpace // confirm
            )
        }
    }

    override fun getPhaseUiTemplateForUiMode(uiMode: UiMode): PhaseUiTemplate {
        return when (uiMode) {
            UiMode.CONFIRM -> PhaseUiTemplates.learnMoveWithConfirm
            else -> throw TemplateUiModeNotSupportedException(uiMode, phaseName)
        }
    }
}