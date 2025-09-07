package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.StatusEffect

class EnemyAttackStatusEffectChanceModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "EnemyAttackStatusEffectChanceModifierType"
    }

    var chancePercent: Int = 0
    var effect: StatusEffect? = null
}