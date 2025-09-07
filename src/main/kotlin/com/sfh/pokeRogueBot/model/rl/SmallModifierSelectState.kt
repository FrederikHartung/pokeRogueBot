package com.sfh.pokeRogueBot.model.rl

import com.sfh.pokeRogueBot.model.modifier.ChooseModifierItem
import com.sfh.pokeRogueBot.model.poke.Pokemon
import org.deeplearning4j.rl4j.space.Encodable
import org.nd4j.linalg.api.ndarray.INDArray
import org.nd4j.linalg.factory.Nd4j

/**
 * Simplified state representation for reinforcement learning in modifier selection scenarios.
 *
 * This class encodes the most critical information needed for an RL agent to make optimal
 * modifier selection decisions during PokeRogue gameplay. The state is deliberately minimal
 * to reduce dimensionality while capturing essential survival and resource information.
 *
 * RL Design Rationale:
 * - Fixed-size state vector (8 elements) enables consistent neural network input
 * - HP buckets (6 elements) represent discrete party health states for better learning
 * - Resource availability (2 elements) enables economic decision making
 *
 * HP Bucket System:
 * Critical for RL: 1.0 bucket ONLY for exactly 100% HP to ensure healing decisions:
 * - 0.0: Fainted (exactly 0% HP) - needs revive
 * - 0.1: Critical (1-10% HP) - emergency healing
 * - 0.2: Very Low (11-20% HP) - urgent healing
 * - 0.3: Low (21-30% HP) - healing recommended
 * - 0.4: Below Half (31-40% HP) - consider healing
 * - 0.5: Near Half (41-50% HP) - healing optional
 * - 0.6: Above Half (51-60% HP) - healing not urgent
 * - 0.7: Good (61-70% HP) - healthy
 * - 0.8: Very Good (71-80% HP) - very healthy
 * - 0.9: Excellent (81-99% HP) - near full (99% HP still gets 0.9!)
 * - 1.0: Perfect (exactly 100% HP) - no healing needed
 *
 * @param hpBuckets HP bucket values per Pokémon (0.0-1.0 in 0.1 increments, fixed array of 6 elements)
 * @param canAffordPotion Binary indicator (0.0/1.0) if player can afford healing items
 * @param freePotionAvailable Binary indicator (0.0/1.0) if free healing items are available
 */
data class SmallModifierSelectState(
    val hpBuckets: DoubleArray, // HP bucket values per Pokémon (0.0-1.0 in 0.1 increments, up to 6 Pokémon)
    val canAffordPotion: Double,
    val freePotionAvailable: Double
) : Encodable {

    override fun toArray(): DoubleArray {
        return hpBuckets + doubleArrayOf(canAffordPotion, freePotionAvailable)
    }

    override fun getData(): INDArray {
        return Nd4j.create(toArray())
    }

    override fun isSkipped(): Boolean {
        return false
    }

    override fun dup(): Encodable {
        return this.copy()
    }

    companion object {
        /**
         * Creates HP bucket values for up to 6 Pokémon in the party.
         * Uses discrete 0.1 increments from 0.0 to 1.0 where value directly represents health level.
         *
         * @param pokemons List of Pokémon in the current party
         * @return DoubleArray of size 6 with HP bucket values (0.0-1.0 in 0.1 increments)
         *
         * RL Relevance: Discrete buckets improve learning by grouping similar health states:
         * - 0.0-0.3: Emergency healing needed
         * - 0.4-0.6: Healing recommended
         * - 0.7-0.9: Healing optional
         * - 1.0: Full health, no healing needed
         */
        fun createHpBuckets(pokemons: List<Pokemon>): DoubleArray {
            val hpBuckets = DoubleArray(6) { 0.0 }

            pokemons.take(6).forEachIndexed { index, pokemon ->
                val maxHp = pokemon.stats.hp
                hpBuckets[index] = when {
                    maxHp <= 0 -> 0.0 // Invalid max HP, treat as fainted
                    pokemon.hp <= 0 -> 0.0 // Fainted (exactly 0% HP)
                    pokemon.hp == maxHp -> 1.0 // ONLY exactly 100% HP gets 1.0 bucket
                    pokemon.hp > maxHp -> 1.0 // Treat as full Health
                    else -> {
                        val hpPercent = pokemon.hp.toDouble() / maxHp.toDouble()
                        // Map to buckets 0.1-0.9 for 1-99% HP
                        // 1-10% → 0.1, 11-20% → 0.2, ..., 91-99% → 0.9
                        ((hpPercent * 10).toInt().coerceAtLeast(1)) / 10.0
                    }
                }
            }

            return hpBuckets
        }

        fun create(
            pokemons: List<Pokemon>,
            shopItems: List<ChooseModifierItem>,
            freeItems: List<ChooseModifierItem>,
            currentMoney: Int
        ): SmallModifierSelectState {
            val hpBuckets = createHpBuckets(pokemons)
            val canAffordPotion = shopItems.any { item -> item.name == "Potion" && item.cost <= currentMoney }
            val freePotionAvailable = freeItems.any { item -> item.name == "Potion" }
            return SmallModifierSelectState(
                hpBuckets,
                canAffordPotion = if (canAffordPotion) 1.0 else 0.0,
                freePotionAvailable = if (freePotionAvailable) 1.0 else 0.0
            )
        }

        /**
         * Creates a SmallModifierSelectState instance from a serialized array.
         *
         * @param array DoubleArray containing state data [6 HP bucket values, canAffordPotion, freePotionAvailable]
         * @return SmallModifierSelectState instance
         * @throws IllegalArgumentException if array doesn't have exactly 8 elements
         */
        fun fromArray(array: DoubleArray): SmallModifierSelectState {
            if (array.size != 8) {
                throw IllegalArgumentException("Array must have exactly 8 elements, got ${array.size}")
            }

            val hpBuckets = array.sliceArray(0..5)
            val canAffordPotion = array[6]
            val freePotionAvailable = array[7]

            return SmallModifierSelectState(hpBuckets, canAffordPotion, freePotionAvailable)
        }
    }
}
