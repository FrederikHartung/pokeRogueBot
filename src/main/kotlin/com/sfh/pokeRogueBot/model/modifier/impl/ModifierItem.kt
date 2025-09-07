package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.ModifierTier
import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem

open class ModifierItem : ChooseModifierItem {
    override var id: String = ""
    override var group: String = ""
    override var tier: ModifierTier? = ModifierTier.COMMON
    override var name: String = ""
    override var typeName: String = ""
    override var x: Int = 0
    override var y: Int = 0
    override var cost: Int = 0
    override var upgradeCount: Int = 0

    override fun toString(): String {
        return "${tier?.name ?: "UNKNOWN"}: $name, Type: $typeName"
    }
}