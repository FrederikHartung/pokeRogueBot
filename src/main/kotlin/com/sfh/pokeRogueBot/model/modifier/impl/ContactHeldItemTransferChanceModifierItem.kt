package com.sfh.pokeRogueBot.model.modifier.impl

class ContactHeldItemTransferChanceModifierItem : PokemonHeldItemModifierItem() {

    companion object {
        const val TARGET = "ContactHeldItemTransferChanceModifierType"
    }

    var chancePercent: Int = 0
}