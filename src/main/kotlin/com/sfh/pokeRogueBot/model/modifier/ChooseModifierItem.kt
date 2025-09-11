package com.sfh.pokeRogueBot.model.modifier

import com.google.common.reflect.TypeToken
import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.rl.HandledModifiers
import java.lang.reflect.Type

interface ChooseModifierItem {

    companion object {
        val LIST_TYPE: Type = object : TypeToken<List<ChooseModifierItem>>() {}.type
    }

    val id: String
    val group: String
    val tier: ModifierTier?
    val name: String
    val typeName: String
    val x: Int
    val y: Int
    val cost: Int
    val upgradeCount: Int

    fun isPotionItem(): Boolean{
        return this.name == HandledModifiers.POTION.modifierName
    }

    fun isReviveItem(): Boolean{
        return this.name == HandledModifiers.REVIVE.modifierName
    }

    fun isMaxReviveItem(): Boolean{
        return this.name == HandledModifiers.MAX_REVIVE.modifierName
    }
}