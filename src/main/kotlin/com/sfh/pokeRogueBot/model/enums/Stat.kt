package com.sfh.pokeRogueBot.model.enums

enum class Stat {
    HP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    SPD;

    companion object {
        fun getBaseStatBoosterItemName(stat: Stat): String? {
            return when (stat) {
                HP -> "HP Up"
                ATK -> "Protein"
                DEF -> "Iron"
                SPATK -> "Calcium"
                SPDEF -> "Zinc"
                SPD -> "Carbos"
            }
        }
    }
}