package com.sfh.pokeRogueBot.model.poke;

public class PokeType {

    private static final float[][] damageMultiplier = new float[][]{
            new float[]{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5f, 0, 1, 1, 0.5f, 1}, //normal
            new float[]{1, 0.5f, 0.5f, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5f, 1, 0.5f, 1, 2, 1}, //fire
            new float[]{1, 2, 0.5f, 1, 0.5f, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5f, 1, 1, 1}, //water
            new float[]{1, 1, 2, 0.5f, 0.5f, 1, 1, 1, 0, 2, 1, 1, 1, 1, 0.5f, 1, 1, 1}, //electric
            new float[]{1, 0.5f, 2, 1, 0.5f, 1, 1, 0.5f, 2, 0.5f, 1, 0.5f, 2, 1, 0.5f, 1, 0.5f, 1}, //grass
            new float[]{1, 0.5f, 0.5f, 1, 2, 0.5f, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 0.5f, 1}, //ice
            new float[]{2, 1, 1, 1, 1, 2, 1, 0.5f, 1, 0.5f, 0.5f, 0.5f, 2, 0, 1, 2, 2, 0.5f}, //fighting
            new float[]{1, 1, 1, 1, 2, 1, 1, 0.5f, 0.5f, 1, 1, 1, 0.5f, 0.5f, 1, 1, 0, 2}, //poison
            new float[]{1, 2, 1, 2, 0.5f, 1, 1, 2, 1, 0, 1, 0.5f, 2, 1, 1, 1, 2, 1}, //ground
            new float[]{1, 1, 1, 0.5f, 2, 1, 2, 1, 1, 1, 1, 2, 0.5f, 1, 1, 1, 0.5f, 1}, //flying
            new float[]{1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0.5f, 1, 1, 1, 1, 0, 0.5f, 1}, //psychic
            new float[]{1, 0.5f, 1, 1, 2, 1, 0.5f, 0.5f, 1, 0.5f, 2, 1, 1, 0.5f, 1, 2, 0.5f, 0.5f}, //bug
            new float[]{1, 2, 1, 1, 1, 2, 0.5f, 1, 0.5f, 2, 1, 2, 1, 1, 1, 1, 0.5f, 1}, //rock
            new float[]{0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 0.5f, 1, 1}, //ghost
            new float[]{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0.5f, 0}, //dragon
            new float[]{1, 1, 1, 1, 1, 1, 0.5f, 1, 1, 1, 2, 1, 1, 2, 1, 0.5f, 1, 0.5f}, //dark
            new float[]{1, 0.5f, 0.5f, 0.5f, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0.5f, 2}, //steel
            new float[]{1, 0.5f, 1, 1, 1, 1, 2, 0.5f, 1, 1, 1, 1, 1, 1, 2, 2, 0.5f, 1} //fairy
    };


    private final int index;
    private PokeType(int index) {
        this.index = index;
    }

    public static float getDamageMultiplier(PokeType attackType, PokeType defenseType){
        return damageMultiplier[attackType.index][defenseType.index];
    }

    public static final PokeType NORMAL = new PokeType(0);
    public static final PokeType FIRE = new PokeType(1);
    public static final PokeType WATER = new PokeType(2);
    public static final PokeType ELECTRIC = new PokeType(3);
    public static final PokeType GRASS = new PokeType(4);
    public static final PokeType ICE = new PokeType(5);
    public static final PokeType FIGHTING = new PokeType(6);
    public static final PokeType POISON = new PokeType(7);
    public static final PokeType GROUND = new PokeType(8);
    public static final PokeType FLYING = new PokeType(9);
    public static final PokeType PSYCHIC = new PokeType(10);
    public static final PokeType BUG = new PokeType(11);
    public static final PokeType ROCK = new PokeType(12);
    public static final PokeType GHOST = new PokeType(13);
    public static final PokeType DRAGON = new PokeType(14);
    public static final PokeType DARK = new PokeType(15);
    public static final PokeType STEEL = new PokeType(16);
    public static final PokeType FAIRY = new PokeType(17);
}
