package com.sfh.pokeRogueBot.model.rl

data class ModifierSelectState(
    val hpPercent: DoubleArray, // HP percentages per Pokémon (0.0-1.0, up to 6 Pokémon)
    val faintedCount: Double, // Number of fainted Pokémon (0.0-6.0)
    // val ivsPerPokemon: Array<DoubleArray>, // IVs per Pokémon [HP, Atk, Def, SpA, SpD, Spe] (0.0-1.0, up to 6 Pokémon)
    // val luck: Double, // Total luck from Shinies (0-14, normalized to 0.0-1.0)
    // val attackRole: DoubleArray, // Physical vs. special role per Pokémon (0.0=special, 1.0=physical, 0.5=mixed)
    val ppPercent: DoubleArray, // PP percentages per Pokémon (0.0-1.0, e.g., min or avg PP% of moves)
    // val typeDist: DoubleArray, // Type distribution (18D, 0.0-1.0)
    val waveIndex: Double, // Normalized: wave / 200.0
    val money: Double, // Normalized: min(money / expectedMaxMoneyForWave, 1.0), where expectedMaxMoneyForWave is dynamic (e.g., 1000 + waveIndex * 50)
    // val rerollCost: Double, // Normalized: reroll cost (ceil(wave/10) * 2^rerollCount) / money (0.0-1.0)
    val freeItems: DoubleArray, // One-Hot: [Healing, Vitamin, Mint, EggVoucher, ...]
    val shopItems: DoubleArray, // One-Hot for purchasable items
    val canAffordItems: DoubleArray, // Can afford each shopItem (1.0=yes, 0.0=no, same length as shopItems)
    val hasFreeRevive: Double // Indicates if a Revive is in freeItems (1.0=yes, 0.0=no)
) {
    // Converts ModifierSelectState to DoubleArray for RL4J INDArray
    fun toDoubleArray(): DoubleArray {
        return doubleArrayOf(
            *hpPercent,
            faintedCount,
            // *ivsPerPokemon.flatten(), // Flattens 6x6D array to 36D
            // luck,
            // *attackRole,
            *ppPercent,
            // *typeDist,
            waveIndex,
            money,
            // rerollCost,
            *freeItems,
            *shopItems,
            *canAffordItems,
            hasFreeRevive
        )
    }
}