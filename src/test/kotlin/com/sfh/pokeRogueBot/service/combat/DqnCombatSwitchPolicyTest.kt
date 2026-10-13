package com.sfh.pokeRogueBot.service.combat

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.enums.BattleType
import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecision
import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.run.WavePokemon
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class DqnCombatSwitchPolicyTest {

    private val support = mockk<CombatPolicySupport>(relaxed = true)
    private val heuristic = mockk<HeuristicCombatSwitchPolicy>(relaxed = true)
    private val worker = mockk<DqnInferenceWorkerClient>()
    private val observations = mockk<CombatObservationClient>()
    private val tracker = CombatDecisionHistoryTracker()
    private val policy = DqnCombatSwitchPolicy(
        support = support,
        heuristicCombatSwitchPolicy = heuristic,
        dqnInferenceWorkerClient = worker,
        combatObservationClient = observations,
        historyTracker = tracker,
        avoidLowValueStatusMoves = false,
        statusMoveOverrideMinDamageRatio = 0.45,
    )
    private val wave = WaveDto(
        wavePokemon = WavePokemon(
            enemyParty = listOf(Pokemon.createDefault()),
            playerParty = listOf(Pokemon.createDefault(), Pokemon.createDefault(), Pokemon.createDefault()),
        ),
        battleType = BattleType.WILD,
        waveIndex = 7,
        turn = 1,
        pokeballCount = IntArray(5),
    )

    @Test
    fun `v4 checkpoint decides a forced switch with the forced-switch state and its mask`() {
        every { worker.featureSchemaVersion() } returns 7
        val mask = listOf(0, 0, 0, 0, 0, 1, 1, 0, 0, 0)
        every { observations.getObservation(CombatDecisionKind.FORCED_SWITCH, any()) } returns state(decisionKind = 1, mask = mask, activeSlot = -1)
        every { worker.inferAction(any(), mask) } returns 6
        val chosen = SwitchDecision(2, "Bench", 1f, 1f)
        every { support.toSwitchDecision(wave, 2) } returns chosen

        assertEquals(chosen, policy.chooseForcedSwitchDecision(wave, false))
        verify(exactly = 0) { observations.getObservation(CombatDecisionKind.COMMAND, any()) }
    }

    @Test
    fun `v3 checkpoint keeps the command state with a switch-only mask for forced switches`() {
        every { worker.featureSchemaVersion() } returns 6
        every { observations.getObservation(CombatDecisionKind.COMMAND, any()) } returns
            state(decisionKind = 0, mask = listOf(1, 1, 0, 0, 0, 1, 1, 0, 0, 0), activeSlot = 0)
        every { worker.inferAction(any(), listOf(0, 0, 0, 0, 0, 1, 1, 0, 0, 0)) } returns 5
        val chosen = SwitchDecision(1, "Bench", 1f, 1f)
        every { support.toSwitchDecision(wave, 1) } returns chosen

        assertEquals(chosen, policy.chooseForcedSwitchDecision(wave, false))
        verify(exactly = 0) { observations.getObservation(CombatDecisionKind.FORCED_SWITCH, any()) }
    }

    @Test
    fun `switch offer is declined when the model keeps the active slot`() {
        every { worker.featureSchemaVersion() } returns 7
        val mask = listOf(0, 0, 0, 0, 1, 1, 1, 0, 0, 0)
        every { observations.getObservation(CombatDecisionKind.CHECK_SWITCH, any()) } returns state(decisionKind = 2, mask = mask, activeSlot = 0)
        every { worker.inferAction(any(), mask) } returns 4

        assertFalse(policy.shouldSwitchPokemon(wave))
    }

    @Test
    fun `accepted switch offer sends out the chosen slot without a second decision`() {
        every { worker.featureSchemaVersion() } returns 7
        val mask = listOf(0, 0, 0, 0, 1, 1, 1, 0, 0, 0)
        every { observations.getObservation(CombatDecisionKind.CHECK_SWITCH, any()) } returns state(decisionKind = 2, mask = mask, activeSlot = 0)
        every { worker.inferAction(any(), mask) } returns 6
        val chosen = SwitchDecision(2, "Bench", 1f, 1f)
        every { support.toSwitchDecision(wave, 2) } returns chosen

        assertTrue(policy.shouldSwitchPokemon(wave))
        assertEquals(chosen, policy.chooseForcedSwitchDecision(wave, false))
        verify(exactly = 1) { worker.inferAction(any(), any()) }
        verify(exactly = 0) { observations.getObservation(CombatDecisionKind.FORCED_SWITCH, any()) }
    }

    @Test
    fun `command switch is recorded in the history for the next decision`() {
        every { observations.getObservation(CombatDecisionKind.COMMAND, any()) } returns
            state(decisionKind = 0, mask = listOf(1, 0, 0, 0, 0, 1, 0, 0, 0, 0), activeSlot = 0)
        every { worker.inferAction(any(), any()) } returns 5
        every { support.toSwitchDecision(wave, 1) } returns SwitchDecision(1, "Bench", 1f, 1f)

        val choice = policy.chooseCommandAction(wave, tryToCatch = false)

        assertEquals(CommandPhaseDecision.SWITCH, choice.commandDecision)
        assertEquals(
            CombatDecisionHistory(lastActionWasSwitch = true, consecutiveSwitchCount = 1, lastSwitchOriginPartyIndex = 1),
            tracker.current(waveIndex = 7, turn = 2, kind = CombatDecisionKind.COMMAND),
        )
    }

    private fun state(decisionKind: Int, mask: List<Int>, activeSlot: Int): Map<String, Any> = mapOf(
        "decision_kind" to decisionKind,
        "action_mask" to mask,
        "party_slots" to (0 until 6).map { slot -> mapOf("active" to if (slot == activeSlot) 1 else 0) },
    )
}
