package com.sfh.pokeRogueBot.service.combat

import org.springframework.stereotype.Component

/** Entscheidungsart im combat-v4-State (`decision_kind`). */
enum class CombatDecisionKind(val value: Int) {
    COMMAND(0),
    FORCED_SWITCH(1),
    CHECK_SWITCH(2),
}

data class CombatDecisionHistory(
    val lastActionWasSwitch: Boolean = false,
    val consecutiveSwitchCount: Int = 0,
    /** Party-Index (nach dem Positionstausch des Spiels), auf dem das zuletzt freiwillig herausgenommene Pokemon liegt. */
    val lastSwitchOriginPartyIndex: Int? = null,
)

/**
 * Fuehrt den Verlauf, den der combat-v4-State nicht aus dem Spiel lesen kann, mit denselben Regeln wie
 * `updateCombatDecisionHistory` in src/main/ts/lib/combat-observation.ts (Collector-Daten = Live-State):
 * - command: Wechsel zaehlt hoch und merkt den Ziel-Slot (dort liegt nach dem Tausch das herausgenommene Pokemon),
 *   Attacke setzt zurueck;
 * - forced_switch: setzt zurueck;
 * - check_switch: Wechsel wie ein freiwilliger Wechsel, "bleiben" (aktiver Slot) setzt zurueck.
 *
 * Der Verlauf gilt pro Kampf (Wave). Dieselbe Entscheidung kann live mehrfach angefragt werden (z. B. wenn der
 * Command-Modus erneut erscheint); pro (Wave, Zug, Entscheidungsart) zaehlt deshalb nur die letzte Anfrage.
 */
@Component
class CombatDecisionHistoryTracker {

    private data class DecisionKey(val waveIndex: Int, val turn: Int, val kind: CombatDecisionKind)

    private var waveIndex: Int = -1
    private var history = CombatDecisionHistory()
    private var lastKey: DecisionKey? = null
    private var historyBeforeLastKey = CombatDecisionHistory()

    @Synchronized
    fun current(waveIndex: Int, turn: Int, kind: CombatDecisionKind): CombatDecisionHistory {
        resetOnNewWave(waveIndex)
        return if (lastKey == DecisionKey(waveIndex, turn, kind)) historyBeforeLastKey else history
    }

    @Synchronized
    fun record(waveIndex: Int, turn: Int, kind: CombatDecisionKind, action: Int, activePartyIndex: Int) {
        val base = current(waveIndex, turn, kind)
        historyBeforeLastKey = base
        lastKey = DecisionKey(waveIndex, turn, kind)
        history = next(base, kind, action, activePartyIndex)
    }

    private fun resetOnNewWave(waveIndex: Int) {
        if (waveIndex != this.waveIndex) {
            this.waveIndex = waveIndex
            history = CombatDecisionHistory()
            lastKey = null
            historyBeforeLastKey = CombatDecisionHistory()
        }
    }

    companion object {
        const val MOVE_ACTIONS = 4

        fun next(history: CombatDecisionHistory, kind: CombatDecisionKind, action: Int, activePartyIndex: Int): CombatDecisionHistory {
            if (kind == CombatDecisionKind.FORCED_SWITCH) {
                return CombatDecisionHistory()
            }
            val targetSlot = action - MOVE_ACTIONS
            val isSwitch = action >= MOVE_ACTIONS
            if (!isSwitch || (kind == CombatDecisionKind.CHECK_SWITCH && targetSlot == activePartyIndex)) {
                return CombatDecisionHistory()
            }
            return CombatDecisionHistory(
                lastActionWasSwitch = true,
                consecutiveSwitchCount = history.consecutiveSwitchCount + 1,
                lastSwitchOriginPartyIndex = targetSlot,
            )
        }
    }
}
