package com.sfh.pokeRogueBot.service.combat

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/** Gleiche Regeln wie updateCombatDecisionHistory in src/main/ts/lib/combat-observation.ts (Collector-Daten = Live-State). */
class CombatDecisionHistoryTrackerTest {

    private val tracker = CombatDecisionHistoryTracker()

    @Test
    fun `command switch counts up and remembers the target slot as origin`() {
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND, action = 6, activePartyIndex = 0)
        tracker.record(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND, action = 5, activePartyIndex = 0)

        assertEquals(
            CombatDecisionHistory(lastActionWasSwitch = true, consecutiveSwitchCount = 2, lastSwitchOriginPartyIndex = 1),
            tracker.current(waveIndex = 5, turn = 3, kind = CombatDecisionKind.COMMAND),
        )
    }

    @Test
    fun `attack resets the switch chain`() {
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND, action = 6, activePartyIndex = 0)
        tracker.record(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND, action = 1, activePartyIndex = 0)

        assertEquals(CombatDecisionHistory(), tracker.current(waveIndex = 5, turn = 3, kind = CombatDecisionKind.COMMAND))
    }

    @Test
    fun `forced switch resets the history`() {
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND, action = 6, activePartyIndex = 0)
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.FORCED_SWITCH, action = 7, activePartyIndex = 0)

        assertEquals(CombatDecisionHistory(), tracker.current(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND))
    }

    @Test
    fun `staying at the switch offer is not a switch`() {
        tracker.record(waveIndex = 5, turn = 0, kind = CombatDecisionKind.CHECK_SWITCH, action = 4, activePartyIndex = 0)

        assertEquals(CombatDecisionHistory(), tracker.current(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND))
    }

    @Test
    fun `accepting the switch offer counts as a voluntary switch`() {
        tracker.record(waveIndex = 5, turn = 0, kind = CombatDecisionKind.CHECK_SWITCH, action = 6, activePartyIndex = 0)

        assertEquals(
            CombatDecisionHistory(lastActionWasSwitch = true, consecutiveSwitchCount = 1, lastSwitchOriginPartyIndex = 2),
            tracker.current(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND),
        )
    }

    @Test
    fun `repeating the same decision in the same turn does not count twice`() {
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND, action = 6, activePartyIndex = 0)
        tracker.record(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND, action = 5, activePartyIndex = 0)
        tracker.record(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND, action = 5, activePartyIndex = 0)

        assertEquals(2, tracker.current(waveIndex = 5, turn = 3, kind = CombatDecisionKind.COMMAND).consecutiveSwitchCount)
        assertEquals(
            CombatDecisionHistory(lastActionWasSwitch = true, consecutiveSwitchCount = 1, lastSwitchOriginPartyIndex = 2),
            tracker.current(waveIndex = 5, turn = 2, kind = CombatDecisionKind.COMMAND),
        )
    }

    @Test
    fun `a new wave starts with an empty history`() {
        tracker.record(waveIndex = 5, turn = 1, kind = CombatDecisionKind.COMMAND, action = 6, activePartyIndex = 0)

        assertEquals(CombatDecisionHistory(), tracker.current(waveIndex = 6, turn = 1, kind = CombatDecisionKind.COMMAND))
    }
}
