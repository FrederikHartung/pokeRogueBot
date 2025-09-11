package com.sfh.pokeRogueBot.model.browser.pokemonjson

data class Stats(
    var hp: Int,
    var attack: Int,
    var defense: Int,
    var specialAttack: Int,
    var specialDefense: Int,
    var speed: Int
) {
    companion object {
        fun createDefault(): Stats {
            return Stats(
                20,
                5,
                5,
                5,
                5,
                5
            )
        }
    }

    fun getBaseTotal(): Int {
        return hp + attack + defense + specialAttack + specialDefense + speed
    }
}