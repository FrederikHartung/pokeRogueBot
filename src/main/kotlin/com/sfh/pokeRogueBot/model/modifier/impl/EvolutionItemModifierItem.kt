package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.EvolutionItem
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class EvolutionItemModifierItem : PokemonModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "EvolutionItemModifierType"
    }

    var evolutionItem: EvolutionItem? = null
}