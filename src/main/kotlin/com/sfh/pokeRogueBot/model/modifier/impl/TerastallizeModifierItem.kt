package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.PokeType
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class TerastallizeModifierItem : PokemonHeldItemModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "TerastallizeModifierType"
    }

    var teraType: PokeType? = null
}