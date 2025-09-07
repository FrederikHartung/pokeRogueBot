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

        fun getBaseTotal(stats: Stats): Int {
            return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed
        }
    }
}