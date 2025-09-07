package com.sfh.pokeRogueBot.model.modifier.impl

class DoubleBattleChanceBoosterModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "DoubleBattleChanceBoosterModifierType"
    }

    var battleCount: Int = 0
}