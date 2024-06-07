package com.sfh.pokeRogueBot.model.poke;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PokeTypeTest {

    @Test
    void the_correct_multiplier_is_returned(){
        assertEquals(1, PokeType.getDamageMultiplier(PokeType.NORMAL, PokeType.FIRE));
        assertEquals(0.5, PokeType.getDamageMultiplier(PokeType.FIRE, PokeType.WATER));
        assertEquals(2, PokeType.getDamageMultiplier(PokeType.FIRE, PokeType.GRASS));
        assertEquals(0.5, PokeType.getDamageMultiplier(PokeType.FIRE, PokeType.ROCK));
        assertEquals(0, PokeType.getDamageMultiplier(PokeType.GHOST, PokeType.NORMAL));
        assertEquals(2, PokeType.getDamageMultiplier(PokeType.GHOST, PokeType.GHOST));
    }

    @Test
    void the_damage_multiplier_matrix_has_the_correct_size(){
        float[][] damageMultiplier = (float[][]) ReflectionTestUtils.getField(PokeType.class, "damageMultiplier");
        assertNotNull(damageMultiplier);
        assertEquals(18, damageMultiplier.length);
        for (int i = 0; i < damageMultiplier.length; i++) {
            assertEquals(18, damageMultiplier[i].length, "Row " + i + " has the wrong length");
        }
    }

    @Test
    void get_type_returns_the_correct_type(){
        assertEquals(PokeType.NORMAL, PokeType.getType(0));
        assertEquals(PokeType.FIRE, PokeType.getType(1));
        assertEquals(PokeType.WATER, PokeType.getType(2));
        assertEquals(PokeType.ELECTRIC, PokeType.getType(3));
        assertEquals(PokeType.GRASS, PokeType.getType(4));
        assertEquals(PokeType.ICE, PokeType.getType(5));
        assertEquals(PokeType.FIGHTING, PokeType.getType(6));
        assertEquals(PokeType.POISON, PokeType.getType(7));
        assertEquals(PokeType.GROUND, PokeType.getType(8));
        assertEquals(PokeType.FLYING, PokeType.getType(9));
        assertEquals(PokeType.PSYCHIC, PokeType.getType(10));
        assertEquals(PokeType.BUG, PokeType.getType(11));
        assertEquals(PokeType.ROCK, PokeType.getType(12));
        assertEquals(PokeType.GHOST, PokeType.getType(13));
        assertEquals(PokeType.DRAGON, PokeType.getType(14));
        assertEquals(PokeType.DARK, PokeType.getType(15));
        assertEquals(PokeType.STEEL, PokeType.getType(16));
        assertEquals(PokeType.FAIRY, PokeType.getType(17));
    }
}