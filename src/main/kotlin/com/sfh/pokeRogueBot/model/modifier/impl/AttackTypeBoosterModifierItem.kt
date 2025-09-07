package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.PokeType
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class AttackTypeBoosterModifierItem : PokemonHeldItemModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "AttackTypeBoosterModifierType"
    }

    var moveType: PokeType? = null
    var boostPercent: Int = 0
}