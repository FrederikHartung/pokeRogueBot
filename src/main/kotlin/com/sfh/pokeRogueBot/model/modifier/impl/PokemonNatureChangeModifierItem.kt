package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.Nature

class PokemonNatureChangeModifierItem : PokemonModifierItem() {

    companion object {
        const val TARGET = "PokemonNatureChangeModifierType"
    }

    var nature: Nature? = null
}