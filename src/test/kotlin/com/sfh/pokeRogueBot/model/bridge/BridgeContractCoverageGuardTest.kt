package com.sfh.pokeRogueBot.model.bridge

import com.sfh.pokeRogueBot.service.javascript.JsService
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import kotlin.reflect.KClass

class BridgeContractCoverageGuardTest {

    private val contractCoveredMethods = setOf(
        "JsService.getWaveDto",
        "JsService.getWavePokemon",
        "JsService.getHatchedPokemon",
        "JsUiService.getUiHandlerDto",
        "JsUiService.getPokemonInLearnMove",
        "JsUiService.getSaveSlots",
        "JsUiService.getModifierShop",
    )

    private val intentionallyExcludedMethods = setOf(
        "JsService.getCurrentPhaseAsString",
        "JsService.getUiMode",
        "JsService.getAvailableStarterPokemon",
        "JsService.getWaveAndTurnIndex",
        "JsService.getEggId",
        "JsService.getNumberOfSelectedStarters",
        "JsService.isUiHandlerActive",
        "JsService.currentBattleHasEnemyTrainer",
        "JsService.resetStarterToDefault",
        "JsUiService.setModifierOptionsCursor",
        "JsUiService.setPokeBallCursor",
        "JsUiService.setPokemonSelectCursor",
        "JsUiService.confirmPokemonSelect",
        "JsUiService.saveAndQuit",
        "JsUiService.setCursorToLoadGame",
        "JsUiService.setCursorToNewGame",
        "JsUiService.submitUserData",
        "JsUiService.setLearnMoveCursor",
        "JsUiService.setCursorToIndex",
        "JsUiService.setCursorToIndexAndConfirm",
        "JsUiService.triggerMessageAdvance",
        "JsUiService.sendCancelButton",
        "JsUiService.sendActionButton",
        "JsUiService.setUiHandlerCursor",
    )

    @Test
    fun `all bridge service methods are classified as contract covered or intentionally excluded`() {
        val actualMethods = collectPublicMethodNames(JsService::class) + collectPublicMethodNames(JsUiService::class)
        val classifiedMethods = contractCoveredMethods + intentionallyExcludedMethods

        val unclassified = actualMethods - classifiedMethods
        val staleClassifications = classifiedMethods - actualMethods

        assertEquals(
            emptySet<String>(),
            unclassified,
            "Bridge contract coverage gap detected. Every JsService/JsUiService method must be either contract-covered or intentionally excluded.",
        )
        assertEquals(
            emptySet<String>(),
            staleClassifications,
            "Bridge contract coverage classification contains stale method names. Update the guard test after refactors.",
        )
    }

    private fun collectPublicMethodNames(type: KClass<*>): Set<String> {
        return type.members
            .filter { member ->
                member.visibility?.name == "PUBLIC" &&
                    member.name !in setOf("equals", "hashCode", "toString")
            }
            .map { "${type.simpleName}.${it.name}" }
            .toSet()
    }
}
