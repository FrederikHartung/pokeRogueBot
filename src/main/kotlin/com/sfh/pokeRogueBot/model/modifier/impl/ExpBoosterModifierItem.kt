package com.sfh.pokeRogueBot.model.modifier.impl

class ExpBoosterModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "ExpBoosterModifierType"
    }

    var boostPercent: Int = 0
}