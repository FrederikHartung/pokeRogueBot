package com.sfh.pokeRogueBot.model.modifier.impl

class PokemonMoveAccuracyBoosterModifierItem : PokemonHeldItemModifierItem() {

    companion object {
        const val TARGET = "PokemonMoveAccuracyBoosterModifierType"
    }

    var amount: Int = 0
}