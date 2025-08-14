package com.sfh.pokeRogueBot.model.modifier

data class MoveToModifierResult(
    val rowIndex: Int,
    val columnIndex: Int,
    val pokemonIndexToSwitchTo: Int,
    val itemName: String
) {
    override fun toString(): String {
        return "$itemName for pokemon at index $pokemonIndexToSwitchTo"
    }
}