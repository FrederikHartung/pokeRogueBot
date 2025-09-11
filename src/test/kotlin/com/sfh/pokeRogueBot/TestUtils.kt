package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.model.rl.SmallModifierSelectState

object TestUtils {

    /**
     * Creates a default SmallModifierSelectState with 3 Pokemon
     * The first Pokemon just have 50% HP
     */
    fun createSmallModifierSelectStateWithHurtPokemon(
        hpBuckets: DoubleArray = doubleArrayOf(0.5, 1.0, 1.0, 0.0, 0.0, 0.0),
        canAffordPotion: Double = 1.0,
        freePotionAvailable: Double = 1.0,
        canAffordRevive: Double = 1.0,
        freeReviveAvailable: Double = 1.0,
        sacredAshAvailable: Double = 1.0,
    ): SmallModifierSelectState{
        return SmallModifierSelectState(
            hpBuckets = hpBuckets,
            canAffordPotion =  canAffordPotion,
            freePotionAvailable = freePotionAvailable,
            canAffordRevive = canAffordRevive,
            freeReviveAvailable = freeReviveAvailable,
            sacredAshAvailable = sacredAshAvailable
        )
    }
}