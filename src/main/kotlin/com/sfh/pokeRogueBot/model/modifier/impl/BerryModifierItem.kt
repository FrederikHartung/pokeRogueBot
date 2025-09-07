package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.BerryType
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class BerryModifierItem : PokemonHeldItemModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "BerryModifierType"
    }

    var berry: BerryType? = null
}