package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.PokeBallType

class AddPokeballModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "AddPokeballModifierType"
    }

    var count: Int = 0
    var pokeballType: PokeBallType? = null
}