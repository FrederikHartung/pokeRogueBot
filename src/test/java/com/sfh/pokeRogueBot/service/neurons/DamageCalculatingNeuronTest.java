package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.results.DamageMultiplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DamageCalculatingNeuronTest {

    Pokemon playerPokemon;
    Pokemon enemyPokemon;

    @BeforeEach
    void setUp() {
        playerPokemon = new Pokemon();
        Species player1Species = new Species();
        playerPokemon.setSpecies(player1Species);
        enemyPokemon = new Pokemon();
        Species enemy1Species = new Species();
        enemyPokemon.setSpecies(enemy1Species);
    }

    @Test
    void damage_multiplier_for_grass_on_fire(){
        playerPokemon.getSpecies().setType1(PokeType.GRASS);
        enemyPokemon.getSpecies().setType1(PokeType.FIRE);
        DamageMultiplier damageMultiplier = DamageCalculatingNeuron.getTypeBasedDamageMultiplier(playerPokemon, enemyPokemon);
        assertNotNull(damageMultiplier);
        assertEquals(0.5f, damageMultiplier.getPlayerDamageMultiplier1());
        assertNull(damageMultiplier.getPlayerDamageMultiplier2());
        assertEquals(2.0f, damageMultiplier.getEnemyDamageMultiplier1());
        assertNull(damageMultiplier.getPlayerDamageMultiplier2());

    }

    @Test
    void damage_multiplier_for_steel_and_dragon_on_grass_and_poison(){
        playerPokemon.getSpecies().setType1(PokeType.STEEL);
        playerPokemon.getSpecies().setType2(PokeType.DRAGON);
        enemyPokemon.getSpecies().setType1(PokeType.GRASS);
        enemyPokemon.getSpecies().setType2(PokeType.POISON);
        DamageMultiplier damageMultiplier = DamageCalculatingNeuron.getTypeBasedDamageMultiplier(playerPokemon, enemyPokemon);
        assertNotNull(damageMultiplier);
        assertEquals(1, damageMultiplier.getPlayerDamageMultiplier1());
        assertEquals(1, damageMultiplier.getPlayerDamageMultiplier2());
        assertEquals(0.25f, damageMultiplier.getEnemyDamageMultiplier1());
        assertEquals(0, damageMultiplier.getEnemyDamageMultiplier2());
    }
}