package com.sfh.pokeRogueBot.model.modifier.impl

class PokemonPpUpModifierItem : PokemonMoveModifierItem() {

    companion object {
        const val TARGET = "PokemonPpUpModifierType"
    }

    var upPoints: Int = 0
}