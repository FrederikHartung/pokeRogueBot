package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicLong

@Component
class DqnCombatSwitchPolicy(
    private val support: CombatPolicySupport,
    private val heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
    private val dqnInferenceWorkerClient: DqnInferenceWorkerClient,
    @param:Value("\${bot.dqn.avoid-low-value-status-moves:true}") private val avoidLowValueStatusMoves: Boolean,
    @param:Value("\${bot.dqn.status-move-override-min-damage-ratio:0.45}") private val statusMoveOverrideMinDamageRatio: Double,
) : CombatSwitchPolicy {

    companion object {
        private val log = LoggerFactory.getLogger(DqnCombatSwitchPolicy::class.java)
        private val forcedSwitchModelCounter = AtomicLong(0)
        private val forcedSwitchFallbackCounter = AtomicLong(0)
        private val forcedSwitchDoubleBattleFallbackCounter = AtomicLong(0)
        private val forcedSwitchEnemyPartyEmptyCounter = AtomicLong(0)
    }

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic combat policy for double battle")
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        }
        if (tryToCatch) {
            log.debug("Falling back to heuristic combat policy because capture flow is active")
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, true)
        }

        val state = support.buildOfflineCombatState(waveDto)
            ?: return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        val actionMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
            .map { if (it == 1) 1 else 0 }

        val action = dqnInferenceWorkerClient.inferAction(state, actionMask)
            ?: return fallbackCommandAction(waveDto, tryToCatch, "model inference unavailable")
        if (action in 0..3) {
            val playerPokemon = support.getActivePlayerPokemon(waveDto)
            val move = playerPokemon?.moveset?.getOrNull(action)
            if (playerPokemon != null && move != null && move.isUsable && move.pPLeft > 0) {
                if (avoidLowValueStatusMoves) {
                    val overrideDecision = support.findStatusMoveAttackOverride(
                        waveDto = waveDto,
                        selectedMoveIndex = action,
                        minDamageRatio = statusMoveOverrideMinDamageRatio,
                    )
                    if (overrideDecision != null) {
                        log.debug(
                            "DQN status-move guard overrode action={} move={} wave={}",
                            action,
                            move.name,
                            waveDto.waveIndex,
                        )
                        return CombatCommandChoice(
                            commandDecision = CommandPhaseDecision.ATTACK,
                            attackDecision = overrideDecision,
                        )
                    }
                }
                log.debug("DQN selected attack action={} move={} wave={}", action, move.name, waveDto.waveIndex)
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.ATTACK,
                    attackDecision = support.toAttackDecision(playerPokemon, action, move),
                )
            }
        }

        if (action in 4..9) {
            val switchDecision = support.toSwitchDecision(waveDto, action - 4)
                ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, true)
            if (switchDecision != null) {
                log.debug("DQN selected switch action={} switchTarget={} wave={}", action, switchDecision.pokeName, waveDto.waveIndex)
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.SWITCH,
                    switchDecision = switchDecision,
                )
            }
        }

        return fallbackCommandAction(waveDto, tryToCatch, "model returned invalid or unusable action=$action")
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic switch policy for double battle")
            return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        }
        val state = support.buildOfflineCombatState(waveDto) ?: return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        val originalMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
        val switchOnlyMask = originalMask.mapIndexed { index, value ->
            if (index in 4..9 && value == 1) 1 else 0
        }
        val action = dqnInferenceWorkerClient.inferAction(state, switchOnlyMask)
            ?: return fallbackSwitchDecision(waveDto, ignoreFirstPokemon, "model inference unavailable")
        return if (action in 4..9) {
            support.toSwitchDecision(waveDto, action - 4) ?: fallbackSwitchDecision(
                waveDto,
                ignoreFirstPokemon,
                "model returned unusable switch action=$action",
            )
        } else {
            fallbackSwitchDecision(waveDto, ignoreFirstPokemon, "model returned non-switch action=$action for switch-only request")
        }
    }

    override fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.isDoubleFight) {
            logForcedSwitchDoubleBattleFallback(waveDto, "double battle")
            return heuristicCombatSwitchPolicy.chooseForcedSwitchDecision(waveDto, ignoreFirstPokemon)
        }
        if (waveDto.wavePokemon.enemyParty.isEmpty()) {
            forcedSwitchEnemyPartyEmptyCounter.incrementAndGet()
            val decision = support.chooseFirstValidSwitchDecision(waveDto, ignoreFirstPokemon)
            log.info(
                "forced_switch_enemy_party_empty count={} wave={} ignoreFirstPokemon={} decision={}",
                forcedSwitchEnemyPartyEmptyCounter.get(),
                waveDto.waveIndex,
                ignoreFirstPokemon,
                decision?.pokeName,
            )
            return decision
        }

        val state = support.buildOfflineCombatState(waveDto)
            ?: return fallbackForcedSwitchDecision(waveDto, ignoreFirstPokemon, "offline state unavailable")
        val originalMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
        val switchOnlyMask = originalMask.mapIndexed { index, value ->
            if (index in 4..9 && value == 1) 1 else 0
        }
        val action = dqnInferenceWorkerClient.inferAction(state, switchOnlyMask)
            ?: return fallbackForcedSwitchDecision(waveDto, ignoreFirstPokemon, "model inference unavailable")
        if (action in 4..9) {
            val decision = support.toSwitchDecision(waveDto, action - 4)
            if (decision != null) {
                val counterValue = forcedSwitchModelCounter.incrementAndGet()
                log.info(
                    "forced_switch_model count={} wave={} action={} decision={}",
                    counterValue,
                    waveDto.waveIndex,
                    action,
                    decision.pokeName,
                )
                return decision
            }
        }

        return fallbackForcedSwitchDecision(
            waveDto,
            ignoreFirstPokemon,
            "model returned invalid forced-switch action=$action",
        )
    }

    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic shouldSwitch decision for double battle")
            return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        }
        val state = support.buildOfflineCombatState(waveDto) ?: return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        val actionMask = ((state["action_mask"] as? List<*>) ?: emptyList<Any>())
            .map { if (it == 1) 1 else 0 }
        val action = dqnInferenceWorkerClient.inferAction(state, actionMask)
            ?: return fallbackShouldSwitch(waveDto, "model inference unavailable")
        return action in 4..9
    }

    private fun fallbackCommandAction(waveDto: WaveDto, tryToCatch: Boolean, reason: String): CombatCommandChoice {
        log.debug("Falling back to heuristic command policy: reason={} wave={}", reason, waveDto.waveIndex)
        return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
    }

    private fun fallbackSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean, reason: String): SwitchDecision? {
        log.debug("Falling back to heuristic switch policy: reason={} wave={}", reason, waveDto.waveIndex)
        return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    private fun fallbackShouldSwitch(waveDto: WaveDto, reason: String): Boolean {
        log.debug("Falling back to heuristic shouldSwitch policy: reason={} wave={}", reason, waveDto.waveIndex)
        return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
    }

    private fun fallbackForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean, reason: String): SwitchDecision? {
        val counterValue = forcedSwitchFallbackCounter.incrementAndGet()
        log.info(
            "forced_switch_fallback count={} wave={} reason={}",
            counterValue,
            waveDto.waveIndex,
            reason,
        )
        return heuristicCombatSwitchPolicy.chooseForcedSwitchDecision(waveDto, ignoreFirstPokemon)
    }

    private fun logForcedSwitchDoubleBattleFallback(waveDto: WaveDto, reason: String) {
        val counterValue = forcedSwitchDoubleBattleFallbackCounter.incrementAndGet()
        log.info(
            "forced_switch_double_battle_fallback count={} wave={} reason={}",
            counterValue,
            waveDto.waveIndex,
            reason,
        )
    }
}
