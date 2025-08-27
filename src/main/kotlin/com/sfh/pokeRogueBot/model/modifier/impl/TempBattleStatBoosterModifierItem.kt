package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.enums.TempBattleStat
import com.sfh.pokeRogueBot.model.modifier.GeneratedPersistentModifierType

class TempBattleStatBoosterModifierItem : ModifierItem(), GeneratedPersistentModifierType {

    companion object {
        const val TARGET = "TempBattleStatBoosterModifierType"
    }

    var tempBattleStat: TempBattleStat? = null
}