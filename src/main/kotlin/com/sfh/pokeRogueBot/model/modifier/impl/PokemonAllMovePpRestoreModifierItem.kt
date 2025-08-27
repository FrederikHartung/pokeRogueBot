package com.sfh.pokeRogueBot.model.modifier.impl

class PokemonAllMovePpRestoreModifierItem : PokemonModifierItem() {

    companion object {
        const val TARGET = "PokemonAllMovePpRestoreModifierType"
    }

    var restorePoints: Int = 0
}