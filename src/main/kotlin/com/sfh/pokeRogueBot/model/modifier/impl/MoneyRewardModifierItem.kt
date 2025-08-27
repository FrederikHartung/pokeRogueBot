package com.sfh.pokeRogueBot.model.modifier.impl

class MoneyRewardModifierItem : ModifierItem() {

    companion object {
        const val TARGET = "MoneyRewardModifierType"
    }

    var moneyMultiplier: Float = 0f
    var moneyMultiplierDescriptorKey: String? = null
}