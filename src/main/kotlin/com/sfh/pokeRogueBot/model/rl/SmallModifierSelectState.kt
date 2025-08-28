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
 * - HP percentages (6 elements) represent party health for survival decisions
 * - Resource availability (2 elements) enables economic decision making
 *
 * @param hpPercent HP percentages per Pokémon (0.0-1.0, fixed array of 6 elements)
 * @param canAffordPotion Binary indicator (0.0/1.0) if player can afford healing items
 * @param freePotionAvailable Binary indicator (0.0/1.0) if free healing items are available
 */
data class SmallModifierSelectState(
    val hpPercent: DoubleArray, // HP percentages per Pokémon (0.0-1.0, up to 6 Pokémon)
    val canAffordPotion: Double,
    val freePotionAvailable: Double
) : Encodable {

    override fun toArray(): DoubleArray {
        return hpPercent + doubleArrayOf(canAffordPotion, freePotionAvailable)
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
         * Creates normalized HP percentages for up to 6 Pokémon in the party.
         *
         * @param pokemons List of Pokémon in the current party
         * @return DoubleArray of size 6 with HP percentages (0.0-1.0)
         *
         * RL Relevance: Critical for survival decisions. Low HP values signal:
         * - Need for healing items (potions, berries)
         * - Risk assessment for upcoming battles
         * - Priority for defensive modifiers when team is weak
         * - Switch/retreat strategies when main Pokémon are damaged
         */
        fun createHpPercent(pokemons: List<Pokemon>): DoubleArray {
            val hpPercentages = DoubleArray(6) { 0.0 }

            pokemons.take(6).forEachIndexed { index, pokemon ->
                val maxHp = pokemon.stats.hp
                if (maxHp > 0) {
                    hpPercentages[index] = pokemon.hp.toDouble() / maxHp.toDouble()
                } else {
                    hpPercentages[index] = 0.0
                }
            }

            return hpPercentages
        }

        fun create(
            pokemons: List<Pokemon>,
            shopItems: List<ChooseModifierItem>,
            freeItems: List<ChooseModifierItem>,
            currentMoney: Int
        ): SmallModifierSelectState {
            val hpPercent = createHpPercent(pokemons)
            val canAffordPotion = shopItems.any { item -> item.name == "Potion" && item.cost <= currentMoney }
            val freePotionAvailable = freeItems.any { item -> item.name == "Potion" }
            return SmallModifierSelectState(
                hpPercent,
                canAffordPotion = if (canAffordPotion) 1.0 else 0.0,
                freePotionAvailable = if (freePotionAvailable) 1.0 else 0.0
            )
        }
    }
}
