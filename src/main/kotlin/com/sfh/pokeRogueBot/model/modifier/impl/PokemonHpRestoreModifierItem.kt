package com.sfh.pokeRogueBot.model.modifier.impl

import com.sfh.pokeRogueBot.model.poke.Pokemon
import kotlin.math.max

open class PokemonHpRestoreModifierItem : PokemonModifierItem() {

    companion object {
        const val TARGET = "PokemonHpRestoreModifierType"
    }

    var healStatus: Boolean = false
    var restorePercent: Int = 0
    var restorePoints: Int = 0

    fun apply(target: Pokemon) {
        val hp = target.hp
        val hpPointsRestored = hp + restorePoints
        val hpPercentRestored = hp + (target.stats.hp * (restorePercent / 100.0)).toInt()

        var newHp = max(hpPointsRestored, hpPercentRestored)
        if (newHp > target.stats.hp) {
            newHp = target.stats.hp
        }

        target.hp = newHp
    }
}