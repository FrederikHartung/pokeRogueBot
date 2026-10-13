package com.sfh.pokeRogueBot.service.combat

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.sfh.pokeRogueBot.service.javascript.JsService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Liest den combat-v4-State aus der JS-Bridge (`window.poru.combat`, gemeinsamer Builder src/main/ts/lib/combat-observation.ts).
 * Kotlin berechnet keine State-Features mehr selbst, damit Live-State und Collector-Daten aus derselben Quelle stammen.
 */
@Component
class CombatObservationClient(
    private val jsService: JsService,
) {

    companion object {
        private val log = LoggerFactory.getLogger(CombatObservationClient::class.java)
        private val MAP_TYPE = object : TypeReference<Map<String, Any>>() {}
    }

    private val objectMapper = ObjectMapper()

    /** Observation fuer die Entscheidung oder null (Doppelkampf, kein aktiver Gegner, Bridge-Fehler). */
    fun getObservation(kind: CombatDecisionKind, history: CombatDecisionHistory): Map<String, Any>? {
        val request = objectMapper.writeValueAsString(
            mapOf(
                "decisionKind" to kind.value,
                "lastActionWasSwitch" to history.lastActionWasSwitch,
                "consecutiveSwitchCount" to history.consecutiveSwitchCount,
                "lastSwitchOriginPartyIndex" to history.lastSwitchOriginPartyIndex,
            ),
        )
        return try {
            val response = objectMapper.readValue(jsService.getCombatObservationJson(request), MAP_TYPE)
            if (response["ok"] == true) {
                @Suppress("UNCHECKED_CAST")
                response["observation"] as? Map<String, Any>
            } else {
                log.debug("combat observation unavailable: {}", response["error"])
                null
            }
        } catch (ex: Exception) {
            log.warn("combat observation request failed: {}", ex.message)
            null
        }
    }
}
