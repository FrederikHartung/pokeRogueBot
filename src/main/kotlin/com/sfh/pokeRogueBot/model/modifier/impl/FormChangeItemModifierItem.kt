package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.FormChangeItem
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class FormChangeItemModifierItem : PokemonModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "FormChangeItemModifierType"
    }

    var formChangeItem: FormChangeItem? = null
}