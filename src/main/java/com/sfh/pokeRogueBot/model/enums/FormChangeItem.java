package com.sfh.pokeRogueBot.model.enums;

import lombok.Getter;

@Getter
public enum FormChangeItem {

    NONE(0),
    ABOMASITE(1),
    ABSOLITE(2),
    AERODACTYLITE(3),
    AGGRONITE(4),
    ALAKAZITE(5),
    ALTARIANITE(6),
    AMPHAROSITE(7),
    AUDINITE(8),
    BANETTITE(9),
    BEEDRILLITE(10),
    BLASTOISINITE(11),
    BLAZIKENITE(12),
    CAMERUPTITE(13),
    CHARIZARDITE_X(14),
    CHARIZARDITE_Y(15),
    DIANCITE(16),
    GALLADITE(17),
    GARCHOMPITE(18),
    GARDEVOIRITE(19),
    GENGARITE(20),
    GLALITITE(21),
    GYARADOSITE(22),
    HERACRONITE(23),
    HOUNDOOMINITE(24),
    KANGASKHANITE(25),
    LATIASITE(26),
    LATIOSITE(27),
    LOPUNNITE(28),
    LUCARIONITE(29),
    MANECTITE(30),
    MAWILITE(31),
    MEDICHAMITE(32),
    METAGROSSITE(33),
    MEWTWONITE_X(34),
    MEWTWONITE_Y(35),
    PIDGEOTITE(36),
    PINSIRITE(37),
    RAYQUAZITE(38),
    SABLENITE(39),
    SALAMENCITE(40),
    SCEPTILITE(41),
    SCIZORITE(42),
    SHARPEDONITE(43),
    SLOWBRONITE(44),
    STEELIXITE(45),
    SWAMPERTITE(46),
    TYRANITARITE(47),
    VENUSAURITE(48),
    BLUE_ORB(50),
    RED_ORB(51),
    SHARP_METEORITE(52),
    HARD_METEORITE(53),
    SMOOTH_METEORITE(54),
    ADAMANT_CRYSTAL(55),
    LUSTROUS_GLOBE(56),
    GRISEOUS_CORE(57),
    REVEAL_GLASS(58),
    GRACIDEA(59),
    MAX_MUSHROOMS(60),
    DARK_STONE(61),
    LIGHT_STONE(62),
    PRISON_BOTTLE(63),
    N_LUNARIZER(64),
    N_SOLARIZER(65),
    RUSTED_SWORD(66),
    RUSTED_SHIELD(67),
    ICY_REINS_OF_UNITY(68),
    SHADOW_REINS_OF_UNITY(69),
    WELLSPRING_MASK(70),
    HEARTHFLAME_MASK(71),
    CORNERSTONE_MASK(72),
    SHOCK_DRIVE(73),
    BURN_DRIVE(74),
    CHILL_DRIVE(75),
    DOUSE_DRIVE(76);

    private final int value;

    FormChangeItem(int value) {
        this.value = value;
    }

    public static FormChangeItem fromValue(int value) {
        for (FormChangeItem item : FormChangeItem.values()) {
            if (item.getValue() == value) {
                return item;
            }
        }
        throw new IllegalArgumentException("Unknown FormChangeItem enum value: " + value);
    }
}

