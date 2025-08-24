package com.sfh.pokeRogueBot.phase.impl

import com.sfh.pokeRogueBot.model.decisions.AttackDecision
import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveAndTurnDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import com.sfh.pokeRogueBot.model.enums.UiMode
import com.sfh.pokeRogueBot.model.exception.NoAttackMoveFoundException
import com.sfh.pokeRogueBot.model.exception.UiModeException
import com.sfh.pokeRogueBot.phase.UiPhase
import com.sfh.pokeRogueBot.service.Brain
import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class CommandPhase(
    private val brain: Brain,
    private val jsService: JsService,
    private val jsUiService: JsUiService
) : UiPhase {

    override val phaseName: String = "CommandPhase"
    var lastWaveIndex: Int = -1
    var attackDecision: AttackDecision? = null

    companion object {
        private val log = LoggerFactory.getLogger(CommandPhase::class.java)
    }

    override fun handleUiMode(uiMode: UiMode) {
        val waveAndTurnDto: WaveAndTurnDto = this.jsService.getWaveAndTurnIndex()

        //when a new run started
        if (brain.shouldResetwaveIndex()) {
            log.debug("Resetting wave index")
            this.lastWaveIndex = -1
        }

        //if the wave has ended, inform the brain
        if (waveAndTurnDto.waveIndex > lastWaveIndex) {
            brain.informWaveEnded(waveAndTurnDto.waveIndex)
            this.lastWaveIndex = waveAndTurnDto.waveIndex
        }

        if (uiMode == UiMode.COMMAND) { //fight, ball, pokemon, run
            val commandPhaseDecision: CommandPhaseDecision? = brain.getCommandDecision()
            val memory =
                "wave: " + waveAndTurnDto.waveIndex + ", turn: " + waveAndTurnDto.turnIndex + ", decision: " + commandPhaseDecision
            brain.memorize(memory)

            try {
                attackDecision = brain.getAttackDecision()
            } catch (e: NoAttackMoveFoundException) {
                log.debug("no attack move found")
                attackDecision = null
            }

            if (commandPhaseDecision == CommandPhaseDecision.ATTACK && null != attackDecision) {
                log.debug("GameMode.COMMAND, Attack decision chosen")
                jsUiService.setUiHandlerCursor(uiMode, 0)
                jsUiService.sendActionButton()
                return
            } else if (commandPhaseDecision == CommandPhaseDecision.BALL || brain.tryToCatchPokemon()) {
                log.debug("GameMode.COMMAND, Ball decision chosen")
                jsUiService.setUiHandlerCursor(uiMode, 1)
                jsUiService.sendActionButton()
                return
            } else if (commandPhaseDecision == CommandPhaseDecision.SWITCH || null == attackDecision) {
                log.debug("GameMode.COMMAND, Switch decision chosen")
                jsUiService.setUiHandlerCursor(uiMode, 2)
                jsUiService.sendActionButton()
                return
            } else if (commandPhaseDecision == CommandPhaseDecision.RUN) {
                log.debug("GameMode.COMMAND, Run decision chosen")
                jsUiService.setUiHandlerCursor(uiMode, 3)
                jsUiService.sendActionButton()
                return
            }
        } else if (uiMode == UiMode.FIGHT) { //which move to use
            checkNotNull(attackDecision) { "cant find a attack move in the command phase" }

            if (attackDecision is AttackDecisionForPokemon) {
                log.debug("found attackDecision for single fight")
                jsUiService.setUiHandlerCursor(uiMode, (attackDecision as AttackDecisionForPokemon).attackIndex)
                jsUiService.sendActionButton()
                return
            } else {
                log.debug("found attackDecision for double fight")
                TODO()
            }
        } else if (uiMode == UiMode.BALL) {
            log.debug("GameMode.BALL, choosing strongest pokeball")
            val pokeballIndex = brain.selectStrongestPokeball()
            log.debug("Selected pokeball index: " + pokeballIndex)
            check(pokeballIndex != -1) { "No pokeballs left" }

            jsUiService.setUiHandlerCursor(uiMode, pokeballIndex)
            jsUiService.sendActionButton()
            return
        } else if (uiMode == UiMode.PARTY) {
            val switchDecision: SwitchDecision = brain.getPokemonSwitchDecision(true)
            jsUiService.setUiHandlerCursor(uiMode, switchDecision.index)
            jsUiService.sendActionButton()
            //TODO: handling for option select?
            return
        }

        throw UiModeException(uiMode)
    }
}