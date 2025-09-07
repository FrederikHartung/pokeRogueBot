package com.sfh.pokeRogueBot.model.enums

enum class PokeType {
    NORMAL, //0
    FIGHTING, //1
    FLYING, //2
    POISON, //3
    GROUND, //4
    ROCK, //5
    BUG, //6
    GHOST, //7
    STEEL, //8
    FIRE, //9
    WATER, //10
    GRASS, //11
    ELECTRIC, //12
    PSYCHIC, //13
    ICE, //14
    DRAGON, //15
    DARK, //16
    FAIRY, //17
    STELLAR; //18

    companion object {
        val DAMAGE_MULTIPLIER = floatArrayOf(
            0f, 0.125f, 0.25f, 0.5f, 1f, 2f, 4f, 8f
        )

        fun getTypeDamageMultiplier(attackType: PokeType?, defType: PokeType?): Float {
            if (attackType == null || defType == null) {
                throw IllegalArgumentException("Unknown or null type")
            }

            return when (defType) {
                NORMAL -> when (attackType) {
                    FIGHTING -> 2f
                    NORMAL, FLYING, POISON, GROUND, ROCK, BUG, STEEL, FIRE, WATER, GRASS, ELECTRIC, PSYCHIC, ICE, DRAGON, DARK, FAIRY -> 1f
                    GHOST -> 0f
                    else -> 0f
                }

                FIGHTING -> when (attackType) {
                    FLYING, PSYCHIC, FAIRY -> 2f
                    NORMAL, FIGHTING, POISON, GROUND, GHOST, STEEL, FIRE, WATER, GRASS, ELECTRIC, ICE, DRAGON -> 1f
                    ROCK, BUG, DARK -> 0.5f
                    else -> 0f
                }

                FLYING -> when (attackType) {
                    ROCK, ELECTRIC, ICE -> 2f
                    NORMAL, FLYING, POISON, GHOST, STEEL, FIRE, WATER, PSYCHIC, DRAGON, DARK, FAIRY -> 1f
                    FIGHTING, BUG, GRASS -> 0.5f
                    GROUND -> 0f
                    else -> 0f
                }

                POISON -> when (attackType) {
                    GROUND, PSYCHIC -> 2f
                    NORMAL, FLYING, ROCK, GHOST, STEEL, FIRE, WATER, ELECTRIC, ICE, DRAGON, DARK -> 1f
                    FIGHTING, POISON, BUG, GRASS, FAIRY -> 0.5f
                    else -> 0f
                }

                GROUND -> when (attackType) {
                    WATER, GRASS, ICE -> 2f
                    NORMAL, FIGHTING, FLYING, GROUND, BUG, GHOST, STEEL, FIRE, PSYCHIC, DRAGON, DARK, FAIRY -> 1f
                    POISON, ROCK -> 0.5f
                    ELECTRIC -> 0f
                    else -> 0f
                }

                ROCK -> when (attackType) {
                    FIGHTING, GROUND, STEEL, WATER, GRASS -> 2f
                    ROCK, BUG, GHOST, ELECTRIC, PSYCHIC, ICE, DRAGON, DARK, FAIRY -> 1f
                    NORMAL, FLYING, POISON, FIRE -> 0.5f
                    else -> 0f
                }

                BUG -> when (attackType) {
                    FLYING, ROCK, FIRE -> 2f
                    NORMAL, POISON, BUG, GHOST, STEEL, WATER, ELECTRIC, PSYCHIC, ICE, DRAGON, DARK, FAIRY -> 1f
                    FIGHTING, GROUND, GRASS -> 0.5f
                    else -> 0f
                }

                GHOST -> when (attackType) {
                    GHOST, DARK -> 2f
                    FLYING, GROUND, ROCK, STEEL, FIRE, WATER, GRASS, ELECTRIC, PSYCHIC, ICE, DRAGON, FAIRY -> 1f
                    POISON, BUG -> 0.5f
                    NORMAL, FIGHTING -> 0f
                    else -> 0f
                }

                STEEL -> when (attackType) {
                    FIGHTING, GROUND, FIRE -> 2f
                    GHOST, WATER, ELECTRIC, DARK -> 1f
                    NORMAL, FLYING, ROCK, BUG, STEEL, GRASS, PSYCHIC, ICE, DRAGON, FAIRY -> 0.5f
                    POISON -> 0f
                    else -> 0f
                }

                FIRE -> when (attackType) {
                    GROUND, ROCK, WATER -> 2f
                    NORMAL, FIGHTING, FLYING, POISON, GHOST, ELECTRIC, PSYCHIC, DRAGON, DARK -> 1f
                    BUG, STEEL, FIRE, GRASS, ICE, FAIRY -> 0.5f
                    else -> 0f
                }

                WATER -> when (attackType) {
                    GRASS, ELECTRIC -> 2f
                    NORMAL, FIGHTING, FLYING, POISON, GROUND, ROCK, BUG, GHOST, PSYCHIC, DRAGON, DARK, FAIRY -> 1f
                    STEEL, FIRE, WATER, ICE -> 0.5f
                    else -> 0f
                }

                GRASS -> when (attackType) {
                    FLYING, POISON, BUG, FIRE, ICE -> 2f
                    NORMAL, FIGHTING, ROCK, GHOST, STEEL, PSYCHIC, DRAGON, DARK, FAIRY -> 1f
                    GROUND, WATER, GRASS, ELECTRIC -> 0.5f
                    else -> 0f
                }

                ELECTRIC -> when (attackType) {
                    GROUND -> 2f
                    NORMAL, FIGHTING, POISON, ROCK, BUG, GHOST, FIRE, WATER, GRASS, PSYCHIC, ICE, DRAGON, DARK, FAIRY -> 1f
                    FLYING, STEEL, ELECTRIC -> 0.5f
                    else -> 0f
                }

                PSYCHIC -> when (attackType) {
                    BUG, GHOST, DARK -> 2f
                    NORMAL, FLYING, POISON, GROUND, ROCK, STEEL, FIRE, WATER, GRASS, ELECTRIC, ICE, DRAGON, FAIRY -> 1f
                    FIGHTING, PSYCHIC -> 0.5f
                    else -> 0f
                }

                ICE -> when (attackType) {
                    FIGHTING, ROCK, STEEL, FIRE -> 2f
                    NORMAL, FLYING, POISON, GROUND, BUG, GHOST, WATER, GRASS, ELECTRIC, PSYCHIC, DRAGON, DARK, FAIRY -> 1f
                    ICE -> 0.5f
                    else -> 0f
                }

                DRAGON -> when (attackType) {
                    ICE, DRAGON, FAIRY -> 2f
                    NORMAL, FIGHTING, FLYING, POISON, GROUND, ROCK, BUG, GHOST, STEEL, PSYCHIC, DARK -> 1f
                    FIRE, WATER, GRASS, ELECTRIC -> 0.5f
                    else -> 0f
                }

                DARK -> when (attackType) {
                    FIGHTING, BUG, FAIRY -> 2f
                    NORMAL, FLYING, POISON, GROUND, ROCK, STEEL, FIRE, WATER, GRASS, ELECTRIC, ICE, DRAGON -> 1f
                    GHOST, DARK -> 0.5f
                    PSYCHIC -> 0f
                    else -> 0f
                }

                FAIRY -> when (attackType) {
                    POISON, STEEL -> 2f
                    NORMAL, FLYING, GROUND, ROCK, GHOST, FIRE, WATER, GRASS, ELECTRIC, PSYCHIC, ICE, FAIRY -> 1f
                    FIGHTING, BUG, DARK -> 0.5f
                    DRAGON -> 0f
                    else -> 0f
                }

                STELLAR -> 1f
            }
        }

        fun getAttackTypeBoosterItemName(type: PokeType): String? {
            return when (type) {
                NORMAL -> "Silk Scarf"
                FIGHTING -> "Black Belt"
                FLYING -> "Sharp Beak"
                POISON -> "Poison Barb"
                GROUND -> "Soft Sand"
                ROCK -> "Hard Stone"
                BUG -> "Silver Powder"
                GHOST -> "Spell Tag"
                STEEL -> "Metal Coat"
                FIRE -> "Charcoal"
                WATER -> "Mystic Water"
                GRASS -> "Miracle Seed"
                ELECTRIC -> "Magnet"
                PSYCHIC -> "Twisted Spoon"
                ICE -> "Never-Melt Ice"
                DRAGON -> "Dragon Fang"
                DARK -> "Black Glasses"
                FAIRY -> "Fairy Feather"
                else -> null
            }
        }
    }
}