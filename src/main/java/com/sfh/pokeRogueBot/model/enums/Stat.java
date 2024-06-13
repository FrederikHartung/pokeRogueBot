package com.sfh.pokeRogueBot.model.enums;

public enum Stat {

    HP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    SPD;

    public static String getBaseStatBoosterItemName(Stat stat) {
        switch (stat) {
            case HP:
                return "HP Up";
            case ATK:
                return "Protein";
            case DEF:
                return "Iron";
            case SPATK:
                return "Calcium";
            case SPDEF:
                return "Zinc";
            case SPD:
                return "Carbos";
        }
        return null;
    }

}