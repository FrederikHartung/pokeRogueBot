package com.sfh.pokeRogueBot.model.poke

/**
 * Represents an Individual Value (IV) for a specific stat of a Pokémon.
 * IVs range from 0 to 31 and determine the potential maximum stat value for a Pokémon.
 * This class includes IVs for HP, Attack, Defense, Special Attack, Special Defense, and Speed.
 */
data class Iv(
    val hp: Int,
    val attack: Int,
    val defense: Int,
    val specialAttack: Int,
    val specialDefense: Int,
    val speed: Int
) {
    companion object {
        fun createDefault(): Iv {
            return Iv(
                20,
                5,
                5,
                5,
                5,
                5
            )
        }
    }
}