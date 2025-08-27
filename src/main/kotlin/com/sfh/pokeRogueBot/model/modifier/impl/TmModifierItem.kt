package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.Moves

class TmModifierItem : PokemonModifierItem() {

    companion object {
        const val TARGET = "TmModifierType"
    }

    var moveId: Moves? = null
}