package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.UnsupportedUiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class LearnMovePhase(
    private val jsUiService: JsUiService,
    private val brain: Brain,
) : UiPhase {

    companion object {
        private val log = LoggerFactory.getLogger(LearnMovePhase::class.java)
    }

    override val phaseName = "LearnMovePhase"

    override fun handleUiMode(uiMode: UiMode) {
        when (uiMode) {
            UiMode.CONFIRM -> {
                jsUiService.setUiHandlerCursor(uiMode, 0)
                jsUiService.sendActionButton()
            }

            //Where all present and the new move are displayed
            UiMode.SUMMARY -> handleLearnMove()
            UiMode.EVOLUTION_SCENE -> jsUiService.triggerMessageAdvance(true)

            else -> throw UnsupportedUiModeException(uiMode)
        }
    }

    private fun handleLearnMove() {
        val pokemon = jsUiService.getPokemonInLearnMove()

        val moveset = pokemon.moveset
        val message = "Pokemon ${pokemon.name} wants to learn move: ${moveset[moveset.size - 1].name}"
        log.debug(message)
        brain.memorize(message)

        val learnMoveDecision = brain.getLearnMoveDecision(pokemon)
            ?: throw IllegalStateException("No learn move decision found for pokemon: ${pokemon.name}")

        if (learnMoveDecision.isNewMoveBetter) {
            jsUiService.setUiHandlerCursor(UiMode.SUMMARY, learnMoveDecision.moveIndexToReplace)
            jsUiService.sendActionButton()
            return
        } else {
            // don't learn move
            jsUiService.sendCancelButton()
            jsUiService.sendActionButton()
        }
    }
}