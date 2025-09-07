package com.sfh.pokeRogueBot.model.modifier.impl

class PokemonExpBoosterModifierItem : PokemonHeldItemModifierItem() {

    companion object {
        const val TARGET = "PokemonExpBoosterModifierType"
    }

    var boostPercent: Int = 0
}