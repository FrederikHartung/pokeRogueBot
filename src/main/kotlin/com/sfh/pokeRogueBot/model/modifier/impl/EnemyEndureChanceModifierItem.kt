package com.sfh.pokeRogueBot.model.modifier.impl

class EnemyEndureChanceModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "EnemyEndureChanceModifierType"
    }

    var chancePercent: Float = 0f
}