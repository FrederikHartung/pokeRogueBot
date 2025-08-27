package com.sfh.pokeRogueBot.model.enums

enum class EvolutionItem(val value: Int) {
    NONE(0),
    LINKING_CORD(1),
    SUN_STONE(2),
    MOON_STONE(3),
    LEAF_STONE(4),
    FIRE_STONE(5),
    WATER_STONE(6),
    THUNDER_STONE(7),
    ICE_STONE(8),
    DUSK_STONE(9),
    DAWN_STONE(10),
    SHINY_STONE(11),
    CRACKED_POT(12),
    SWEET_APPLE(13),
    TART_APPLE(14),
    STRAWBERRY_SWEET(15),
    UNREMARKABLE_TEACUP(16),
    CHIPPED_POT(51),
    BLACK_AUGURITE(52),
    GALARICA_CUFF(53),
    GALARICA_WREATH(54),
    PEAT_BLOCK(55),
    AUSPICIOUS_ARMOR(56),
    MALICIOUS_ARMOR(57),
    MASTERPIECE_TEACUP(58),
    METAL_ALLOY(59),
    SCROLL_OF_DARKNESS(60),
    SCROLL_OF_WATERS(61),
    SYRUPY_APPLE(62);

    companion object {
        fun fromValue(value: Int): EvolutionItem {
            return values().find { it.value == value }
                ?: throw IllegalArgumentException("Unknown enum value: $value")
        }
    }
}