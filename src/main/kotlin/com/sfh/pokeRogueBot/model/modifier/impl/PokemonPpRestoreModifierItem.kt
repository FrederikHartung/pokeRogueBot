package com.sfh.pokeRogueBot.model.modifier.impl

class PokemonPpRestoreModifierItem : PokemonMoveModifierItem() {

    companion object {
        const val TARGET = "PokemonPpRestoreModifierType"
    }

    var restorePoints: Int = 0
}