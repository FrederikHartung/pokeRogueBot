package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.Stat
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class PokemonBaseStatBoosterModifierItem : PokemonHeldItemModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "PokemonBaseStatBoosterModifierType"
    }

    var stat: Stat? = null
    var localeName: String? = null
}