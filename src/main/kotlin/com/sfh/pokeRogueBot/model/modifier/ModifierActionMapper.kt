package com.sfh.pokeRogueBot.model.modifier

import com.sfh.pokeRogueBot.model.poke.Pokemon
import com.sfh.pokeRogueBot.model.rl.HandledModifiers
import com.sfh.pokeRogueBot.model.rl.ModifierAction

object ModifierActionMapper {

    /**
     * Converts an RL action back into a game-executable result.
     * This bridges the gap between RL decisions and the game's expected format.
     *
     * @param action The action chosen by the RL agent
     * @param shop The current modifier shop for item lookup
     * @return MoveToModifierResult that can be executed by the game, or null for SKIP
     */
    fun convertActionToResult(action: ModifierAction, shop: ModifierShop, team: List<Pokemon>): MoveToModifierResult? {
        return when (action) {

            //Potion
            ModifierAction.TAKE_FREE_POTION -> {
                val item = shop.freeItems.first { item -> item.isPotionItem() }
                val indexToMoveTo = getLowestNonFaintedPokemonIndex(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }
            ModifierAction.BUY_POTION -> {
                val item = shop.shopItems.first { item -> item.isPotionItem() }
                val indexToMoveTo = getLowestNonFaintedPokemonIndex(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }

            //Revive
            ModifierAction.TAKE_FREE_REVIVE -> {
                val item = shop.freeItems.first { item -> item.isReviveItem() }
                val indexToMoveTo = getFaintedPokemonWithMaxBaseStats(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }
            ModifierAction.BUY_REVIVE -> {
                val item = shop.shopItems.first { item -> item.isReviveItem() }
                val indexToMoveTo = getFaintedPokemonWithMaxBaseStats(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }

            //Max Revive
            ModifierAction.TAKE_FREE_MAX_REVIVE -> {
                val item = shop.freeItems.first { item -> item.isMaxReviveItem() }
                val indexToMoveTo = getFaintedPokemonWithMaxBaseStats(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }
            ModifierAction.BUY_MAX_REVIVE -> {
                val item = shop.shopItems.first { item -> item.isMaxReviveItem() }
                val indexToMoveTo = getFaintedPokemonWithMaxBaseStats(team)
                MoveToModifierResult(item.y, item.x, indexToMoveTo, item.name)
            }

            ModifierAction.TAKE_SACRET_ASH -> {
                val item = shop.freeItems.first { item -> item.name == HandledModifiers.SACRET_ASH.modifierName }
                MoveToModifierResult(item.y, item.x, -1, item.name)
            }

            ModifierAction.SKIP -> {
                null
            }
        }
    }

    private fun getLowestNonFaintedPokemonIndex(team: List<Pokemon>): Int {
        return team.withIndex()
            .filter { (_, pokemon) -> pokemon.isHurt() }
            .minByOrNull { (_, pokemon) -> pokemon.hp.toDouble() / pokemon.stats.hp.toDouble() }
            ?.index ?: -1
    }

    private fun getFaintedPokemonWithMaxBaseStats(team: List<Pokemon>): Int {
        return team.withIndex()
            .filter { (_, pokemon) -> !pokemon.isAlive() }
            .maxByOrNull { (_, pokemon) -> pokemon.stats.getBaseTotal() }
            ?.index ?: -1
    }
}