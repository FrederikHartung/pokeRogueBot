package com.sfh.pokeRogueBot.model.enums;

import lombok.Getter;

@Getter
public enum PokeType {
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

    public static final float[] DAMAGE_MULTIPLIER = new float[]{
            0f, 0.125f, 0.25f, 0.5f, 1f, 2f, 4f, 8f
    };

    public static float getTypeDamageMultiplier(PokeType attackType, PokeType defType) {
        if (attackType == null || defType == null) {
            throw new IllegalArgumentException("Unknown or null type");
        }

        switch (defType) {
            case NORMAL:
                switch (attackType) {
                    case FIGHTING:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case ROCK:
                    case BUG:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case GHOST:
                    default:
                        return 0;
                }
            case FIGHTING:
                switch (attackType) {
                    case FLYING:
                    case PSYCHIC:
                    case FAIRY:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case POISON:
                    case GROUND:
                    case GHOST:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case ICE:
                    case DRAGON:
                        return 1;
                    case ROCK:
                    case BUG:
                    case DARK:
                        return 0.5f;
                    default:
                        return 0;
                }
            case FLYING:
                switch (attackType) {
                    case ROCK:
                    case ELECTRIC:
                    case ICE:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case GHOST:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case FIGHTING:
                    case BUG:
                    case GRASS:
                        return 0.5f;
                    case GROUND:
                    default:
                        return 0;
                }
            case POISON:
                switch (attackType) {
                    case GROUND:
                    case PSYCHIC:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case ROCK:
                    case GHOST:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case ELECTRIC:
                    case ICE:
                    case DRAGON:
                    case DARK:
                        return 1;
                    case FIGHTING:
                    case POISON:
                    case BUG:
                    case GRASS:
                    case FAIRY:
                        return 0.5f;
                    default:
                        return 0;
                }
            case GROUND:
                switch (attackType) {
                    case WATER:
                    case GRASS:
                    case ICE:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case FLYING:
                    case GROUND:
                    case BUG:
                    case GHOST:
                    case STEEL:
                    case FIRE:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case POISON:
                    case ROCK:
                        return 0.5f;
                    case ELECTRIC:
                    default:
                        return 0;
                }
            case ROCK:
                switch (attackType) {
                    case FIGHTING:
                    case GROUND:
                    case STEEL:
                    case WATER:
                    case GRASS:
                        return 2;
                    case ROCK:
                    case BUG:
                    case GHOST:
                    case ELECTRIC:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case FIRE:
                        return 0.5f;
                    default:
                        return 0;
                }
            case BUG:
                switch (attackType) {
                    case FLYING:
                    case ROCK:
                    case FIRE:
                        return 2;
                    case NORMAL:
                    case POISON:
                    case BUG:
                    case GHOST:
                    case STEEL:
                    case WATER:
                    case ELECTRIC:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case FIGHTING:
                    case GROUND:
                    case GRASS:
                        return 0.5f;
                    default:
                        return 0;
                }
            case GHOST:
                switch (attackType) {
                    case GHOST:
                    case DARK:
                        return 2;
                    case FLYING:
                    case GROUND:
                    case ROCK:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case FAIRY:
                        return 1;
                    case POISON:
                    case BUG:
                        return 0.5f;
                    case NORMAL:
                    case FIGHTING:
                    default:
                        return 0;
                }
            case STEEL:
                switch (attackType) {
                    case FIGHTING:
                    case GROUND:
                    case FIRE:
                        return 2;
                    case GHOST:
                    case WATER:
                    case ELECTRIC:
                    case DARK:
                        return 1;
                    case NORMAL:
                    case FLYING:
                    case ROCK:
                    case BUG:
                    case STEEL:
                    case GRASS:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case FAIRY:
                        return 0.5f;
                    case POISON:
                    default:
                        return 0;
                }
            case FIRE:
                switch (attackType) {
                    case GROUND:
                    case ROCK:
                    case WATER:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case FLYING:
                    case POISON:
                    case GHOST:
                    case ELECTRIC:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                        return 1;
                    case BUG:
                    case STEEL:
                    case FIRE:
                    case GRASS:
                    case ICE:
                    case FAIRY:
                        return 0.5f;
                    default:
                        return 0;
                }
            case WATER:
                switch (attackType) {
                    case GRASS:
                    case ELECTRIC:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case ROCK:
                    case BUG:
                    case GHOST:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case ICE:
                        return 0.5f;
                    default:
                        return 0;
                }
            case GRASS:
                switch (attackType) {
                    case FLYING:
                    case POISON:
                    case BUG:
                    case FIRE:
                    case ICE:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case ROCK:
                    case GHOST:
                    case STEEL:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case GROUND:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                        return 0.5f;
                    default:
                        return 0;
                }
            case ELECTRIC:
                switch (attackType) {
                    case GROUND:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case POISON:
                    case ROCK:
                    case BUG:
                    case GHOST:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case PSYCHIC:
                    case ICE:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case FLYING:
                    case STEEL:
                    case ELECTRIC:
                        return 0.5f;
                    default:
                        return 0;
                }
            case PSYCHIC:
                switch (attackType) {
                    case BUG:
                    case GHOST:
                    case DARK:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case ROCK:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case ICE:
                    case DRAGON:
                    case FAIRY:
                        return 1;
                    case FIGHTING:
                    case PSYCHIC:
                        return 0.5f;
                    default:
                        return 0;
                }
            case ICE:
                switch (attackType) {
                    case FIGHTING:
                    case ROCK:
                    case STEEL:
                    case FIRE:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case BUG:
                    case GHOST:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case PSYCHIC:
                    case DRAGON:
                    case DARK:
                    case FAIRY:
                        return 1;
                    case ICE:
                        return 0.5f;
                    default:
                        return 0;
                }
            case DRAGON:
                switch (attackType) {
                    case ICE:
                    case DRAGON:
                    case FAIRY:
                        return 2;
                    case NORMAL:
                    case FIGHTING:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case ROCK:
                    case BUG:
                    case GHOST:
                    case STEEL:
                    case PSYCHIC:
                    case DARK:
                        return 1;
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                        return 0.5f;
                    default:
                        return 0;
                }
            case DARK:
                switch (attackType) {
                    case FIGHTING:
                    case BUG:
                    case FAIRY:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case POISON:
                    case GROUND:
                    case ROCK:
                    case STEEL:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case ICE:
                    case DRAGON:
                        return 1;
                    case GHOST:
                    case DARK:
                        return 0.5f;
                    case PSYCHIC:
                    default:
                        return 0;
                }
            case FAIRY:
                switch (attackType) {
                    case POISON:
                    case STEEL:
                        return 2;
                    case NORMAL:
                    case FLYING:
                    case GROUND:
                    case ROCK:
                    case GHOST:
                    case FIRE:
                    case WATER:
                    case GRASS:
                    case ELECTRIC:
                    case PSYCHIC:
                    case ICE:
                    case FAIRY:
                        return 1;
                    case FIGHTING:
                    case BUG:
                    case DARK:
                        return 0.5f;
                    case DRAGON:
                    default:
                        return 0;
                }
            case STELLAR:
                return 1;
        }

        return 1; //fallback
    }

    public static String getAttackTypeBoosterItemName(PokeType type) {
        switch (type) {
            case NORMAL:
                return "Silk Scarf";
            case FIGHTING:
                return "Black Belt";
            case FLYING:
                return "Sharp Beak";
            case POISON:
                return "Poison Barb";
            case GROUND:
                return "Soft Sand";
            case ROCK:
                return "Hard Stone";
            case BUG:
                return "Silver Powder";
            case GHOST:
                return "Spell Tag";
            case STEEL:
                return "Metal Coat";
            case FIRE:
                return "Charcoal";
            case WATER:
                return "Mystic Water";
            case GRASS:
                return "Miracle Seed";
            case ELECTRIC:
                return "Magnet";
            case PSYCHIC:
                return "Twisted Spoon";
            case ICE:
                return "Never-Melt Ice";
            case DRAGON:
                return "Dragon Fang";
            case DARK:
                return "Black Glasses";
            case FAIRY:
                return "Fairy Feather";
        }

        return null; //fallback
    }
}
