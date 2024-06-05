package com.sfh.pokeRogueBot.model.poke;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

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
}