package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.AttackDecisionForPokemon
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicLong

/**
 * Combat-DQN fuer den Live-Bot. Der State kommt aus der JS-Bridge (combat-v4, gemeinsamer Builder mit den Collectors);
 * die Inferenz waehlt den Encoder passend zum Checkpoint.
 *
 * Zwangswechsel nach K.O. und Wechselangebot zu Kampfbeginn laufen bei combat-v4-Checkpoints (Feature-Version >= 7)
 * mit eigener Entscheidungsart. Bei v3-Checkpoints bleibt es beim bisherigen Verhalten: Command-State mit Wechsel-Maske.
 */
@Component
class DqnCombatSwitchPolicy(
    private val support: CombatPolicySupport,
    private val heuristicCombatSwitchPolicy: HeuristicCombatSwitchPolicy,
    private val dqnInferenceWorkerClient: DqnInferenceWorkerClient,
    private val combatObservationClient: CombatObservationClient,
    private val historyTracker: CombatDecisionHistoryTracker,
    @param:Value("\${bot.dqn.avoid-low-value-status-moves:true}") private val avoidLowValueStatusMoves: Boolean,
    @param:Value("\${bot.dqn.status-move-override-min-damage-ratio:0.45}") private val statusMoveOverrideMinDamageRatio: Double,
) : CombatSwitchPolicy {

    companion object {
        private val log = LoggerFactory.getLogger(DqnCombatSwitchPolicy::class.java)
        const val COMBAT_V4_FEATURE_SCHEMA_VERSION = 7
        private const val MOVE_ACTIONS = 4
        private val SWITCH_ACTIONS = 4..9
        private val forcedSwitchModelCounter = AtomicLong(0)
        private val forcedSwitchFallbackCounter = AtomicLong(0)
        private val forcedSwitchDoubleBattleFallbackCounter = AtomicLong(0)
        private val forcedSwitchEnemyPartyEmptyCounter = AtomicLong(0)
    }

    private data class PendingCheckSwitch(val waveIndex: Int, val partyIndex: Int)

    /** Slot, den das Modell beim Wechselangebot gewaehlt hat; die folgende SwitchPhase schickt ihn ohne neue Entscheidung. */
    @Volatile
    private var pendingCheckSwitch: PendingCheckSwitch? = null

    override fun chooseCommandAction(waveDto: WaveDto, tryToCatch: Boolean): CombatCommandChoice {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic combat policy for double battle")
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        }
        if (tryToCatch) {
            log.debug("Falling back to heuristic combat policy because capture flow is active")
            return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, true)
        }

        val state = observe(waveDto, CombatDecisionKind.COMMAND)
            ?: return heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)

        val action = dqnInferenceWorkerClient.inferAction(state, maskOf(state))
            ?: return fallbackCommandAction(waveDto, state, tryToCatch, "model inference unavailable")
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
                        record(waveDto, CombatDecisionKind.COMMAND, state, overrideDecision.attackIndex)
                        return CombatCommandChoice(
                            commandDecision = CommandPhaseDecision.ATTACK,
                            attackDecision = overrideDecision,
                        )
                    }
                }
                log.debug("DQN selected attack action={} move={} wave={}", action, move.name, waveDto.waveIndex)
                record(waveDto, CombatDecisionKind.COMMAND, state, action)
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.ATTACK,
                    attackDecision = support.toAttackDecision(playerPokemon, action, move),
                )
            }
        }

        if (action in SWITCH_ACTIONS) {
            val switchDecision = support.toSwitchDecision(waveDto, action - MOVE_ACTIONS)
                ?: heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, true)
            if (switchDecision != null) {
                log.debug("DQN selected switch action={} switchTarget={} wave={}", action, switchDecision.pokeName, waveDto.waveIndex)
                record(waveDto, CombatDecisionKind.COMMAND, state, MOVE_ACTIONS + switchDecision.index)
                return CombatCommandChoice(
                    commandDecision = CommandPhaseDecision.SWITCH,
                    switchDecision = switchDecision,
                )
            }
        }

        return fallbackCommandAction(waveDto, state, tryToCatch, "model returned invalid or unusable action=$action")
    }

    override fun chooseSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic switch policy for double battle")
            return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        }
        val state = observe(waveDto, CombatDecisionKind.COMMAND)
            ?: return heuristicCombatSwitchPolicy.chooseSwitchDecision(waveDto, ignoreFirstPokemon)
        val action = dqnInferenceWorkerClient.inferAction(state, switchOnly(maskOf(state)))
            ?: return fallbackSwitchDecision(waveDto, ignoreFirstPokemon, "model inference unavailable")
        val decision = if (action in SWITCH_ACTIONS) support.toSwitchDecision(waveDto, action - MOVE_ACTIONS) else null
        if (decision == null) {
            return fallbackSwitchDecision(waveDto, ignoreFirstPokemon, "model returned unusable switch action=$action")
        }
        record(waveDto, CombatDecisionKind.COMMAND, state, MOVE_ACTIONS + decision.index)
        return decision
    }

    override fun chooseForcedSwitchDecision(waveDto: WaveDto, ignoreFirstPokemon: Boolean): SwitchDecision? {
        takePendingCheckSwitch(waveDto)?.let { return it }
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

        // v4: eigene Entscheidungsart mit der Maske des States; v3: Command-State mit Wechsel-Maske wie bisher.
        val usesDecisionKinds = modelUsesDecisionKinds()
        val kind = if (usesDecisionKinds) CombatDecisionKind.FORCED_SWITCH else CombatDecisionKind.COMMAND
        val state = observe(waveDto, kind)
            ?: return fallbackForcedSwitchDecision(waveDto, ignoreFirstPokemon, "combat observation unavailable")
        val mask = if (usesDecisionKinds) maskOf(state) else switchOnly(maskOf(state))
        val action = dqnInferenceWorkerClient.inferAction(state, mask)
            ?: return fallbackForcedSwitchDecision(waveDto, ignoreFirstPokemon, "model inference unavailable")
        if (action in SWITCH_ACTIONS) {
            val decision = support.toSwitchDecision(waveDto, action - MOVE_ACTIONS)
            if (decision != null) {
                val counterValue = forcedSwitchModelCounter.incrementAndGet()
                log.info(
                    "forced_switch_model count={} wave={} action={} decision={} decisionKind={}",
                    counterValue,
                    waveDto.waveIndex,
                    action,
                    decision.pokeName,
                    kind,
                )
                record(waveDto, CombatDecisionKind.FORCED_SWITCH, state, action)
                return decision
            }
        }

        return fallbackForcedSwitchDecision(
            waveDto,
            ignoreFirstPokemon,
            "model returned invalid forced-switch action=$action",
        )
    }

    /** Wechselangebot zu Kampfbeginn (CheckSwitchPhase). */
    override fun shouldSwitchPokemon(waveDto: WaveDto): Boolean {
        if (waveDto.isDoubleFight) {
            log.debug("Falling back to heuristic shouldSwitch decision for double battle")
            return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        }
        if (!modelUsesDecisionKinds()) {
            val state = observe(waveDto, CombatDecisionKind.COMMAND)
                ?: return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
            val action = dqnInferenceWorkerClient.inferAction(state, maskOf(state))
                ?: return fallbackShouldSwitch(waveDto, "model inference unavailable")
            return action in SWITCH_ACTIONS
        }

        val state = observe(waveDto, CombatDecisionKind.CHECK_SWITCH)
            ?: return heuristicCombatSwitchPolicy.shouldSwitchPokemon(waveDto)
        val action = dqnInferenceWorkerClient.inferAction(state, maskOf(state))
            ?: return fallbackShouldSwitch(waveDto, "model inference unavailable")
        if (action !in SWITCH_ACTIONS) {
            return fallbackShouldSwitch(waveDto, "model returned non-switch action=$action for check switch")
        }
        record(waveDto, CombatDecisionKind.CHECK_SWITCH, state, action)
        val slot = action - MOVE_ACTIONS
        if (slot == activeSlotOf(state)) {
            log.debug("DQN keeps the lead at the switch offer wave={}", waveDto.waveIndex)
            return false
        }
        pendingCheckSwitch = PendingCheckSwitch(waveDto.waveIndex, slot)
        log.debug("DQN accepts the switch offer wave={} slot={}", waveDto.waveIndex, slot)
        return true
    }

    private fun takePendingCheckSwitch(waveDto: WaveDto): SwitchDecision? {
        val pending = pendingCheckSwitch ?: return null
        pendingCheckSwitch = null
        if (pending.waveIndex != waveDto.waveIndex) {
            return null
        }
        return support.toSwitchDecision(waveDto, pending.partyIndex)
    }

    private fun modelUsesDecisionKinds(): Boolean =
        (dqnInferenceWorkerClient.featureSchemaVersion() ?: 0) >= COMBAT_V4_FEATURE_SCHEMA_VERSION

    private fun observe(waveDto: WaveDto, kind: CombatDecisionKind): Map<String, Any>? {
        if (waveDto.isDoubleFight) {
            return null
        }
        return combatObservationClient.getObservation(kind, historyTracker.current(waveDto.waveIndex, waveDto.turn, kind))
    }

    private fun record(waveDto: WaveDto, kind: CombatDecisionKind, state: Map<String, Any>, action: Int) {
        historyTracker.record(waveDto.waveIndex, waveDto.turn, kind, action, activeSlotOf(state))
    }

    private fun maskOf(state: Map<String, Any>): List<Int> =
        ((state["action_mask"] as? List<*>) ?: emptyList<Any>()).map { if (it == 1) 1 else 0 }

    private fun switchOnly(mask: List<Int>): List<Int> =
        mask.mapIndexed { index, value -> if (index in SWITCH_ACTIONS && value == 1) 1 else 0 }

    private fun activeSlotOf(state: Map<String, Any>): Int =
        ((state["party_slots"] as? List<*>) ?: emptyList<Any>())
            .indexOfFirst { slot -> (slot as? Map<*, *>)?.get("active") == 1 }

    private fun fallbackCommandAction(
        waveDto: WaveDto,
        state: Map<String, Any>,
        tryToCatch: Boolean,
        reason: String,
    ): CombatCommandChoice {
        log.debug("Falling back to heuristic command policy: reason={} wave={}", reason, waveDto.waveIndex)
        val choice = heuristicCombatSwitchPolicy.chooseCommandAction(waveDto, tryToCatch)
        val attack = choice.attackDecision as? AttackDecisionForPokemon
        when {
            choice.switchDecision != null ->
                record(waveDto, CombatDecisionKind.COMMAND, state, MOVE_ACTIONS + choice.switchDecision.index)
            attack != null -> record(waveDto, CombatDecisionKind.COMMAND, state, attack.attackIndex)
        }
        return choice
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
