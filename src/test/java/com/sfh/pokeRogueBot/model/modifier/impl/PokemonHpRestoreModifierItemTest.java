package com.sfh.pokeRogueBot.model.modifier.impl;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PokemonHpRestoreModifierItemTest {

    @Test
    void a_potion_is_applied_to_a_pokemon() {
        PokemonHpRestoreModifierItem potion = new PokemonHpRestoreModifierItem();
        potion.setRestorePoints(20);
        potion.setRestorePercent(10);

        Pokemon pokemon = new Pokemon();
        pokemon.setHp(80);
        pokemon.setStats(new Stats());
        pokemon.getStats().setHp(100);

        potion.apply(pokemon);

        assertEquals(100, pokemon.getHp());
    }

    @Test
    void a_potion_is_applied_to_a_pokemon_points() {
        PokemonHpRestoreModifierItem potion = new PokemonHpRestoreModifierItem();
        potion.setRestorePoints(20);
        potion.setRestorePercent(10);

        Pokemon pokemon = new Pokemon();
        pokemon.setHp(70);
        pokemon.setStats(new Stats());
        pokemon.getStats().setHp(100);

        potion.apply(pokemon);

        assertEquals(90, pokemon.getHp());
    }

    @Test
    void a_potion_is_applied_to_a_pokemon_percentage() {
        PokemonHpRestoreModifierItem potion = new PokemonHpRestoreModifierItem();
        potion.setRestorePoints(5);
        potion.setRestorePercent(10);

        Pokemon pokemon = new Pokemon();
        pokemon.setHp(70);
        pokemon.setStats(new Stats());
        pokemon.getStats().setHp(100);

        potion.apply(pokemon);

        assertEquals(80, pokemon.getHp());
    }

}