package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CapturePokemonNeuronTest {

    CapturePokemonNeuron capturePokemonNeuron;
    WaveDto waveDto;
    Pokemon wildPokemon;
    int[] pokeballs;

    @BeforeEach
    void setUp() {
        CapturePokemonNeuron objToSpy = new CapturePokemonNeuron();
        capturePokemonNeuron = spy(objToSpy);

        waveDto = mock(WaveDto.class);
        wildPokemon = new Pokemon();

        pokeballs = new int[]{
                5,
                0,
                0,
                0,
                0
        };

        doReturn(false).when(waveDto).isTrainerFight();
        doReturn(true).when(waveDto).hasPokeBalls();
        doReturn(true).when(waveDto).isOnlyOneEnemyLeft();
        doReturn(pokeballs).when(waveDto).getPokeballCount();

    }

    @Test
    void a_catchable_pokemon_should_be_captured() {
        assertTrue(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void a_trainer_pokemon_should_not_be_captured() {
        doReturn(true).when(waveDto).isTrainerFight();
        assertFalse(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void pokemon_should_not_be_captured_if_balls_are_empty() {
        doReturn(false).when(waveDto).hasPokeBalls();
        assertFalse(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void pokemon_should_not_be_captured_if_a_second_enemy_is_present() {
        doReturn(false).when(waveDto).isOnlyOneEnemyLeft();
        assertFalse(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void pokemon_should_not_be_captured_if_a_boss_has_to_much_hp_left() {
        wildPokemon.setBoss(true);
        wildPokemon.setHp(50);
        Stats stats = new Stats();
        stats.setHp(100);
        wildPokemon.setStats(stats);
        wildPokemon.setBossSegments(3);

        assertFalse(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void a_pokeball_should_be_selected() {
        assertEquals(0, capturePokemonNeuron.selectStrongestPokeball(waveDto));
    }

    @Test
    void no_pokeball_should_be_selected_if_no_balls_are_left() {
        pokeballs[0] = 0;
        assertEquals(-1, capturePokemonNeuron.selectStrongestPokeball(waveDto));
    }

    @Test
    void a_rogue_ball_should_be_selected() {
        pokeballs[0] = 0;
        pokeballs[3] = 5;
        assertEquals(3, capturePokemonNeuron.selectStrongestPokeball(waveDto));
    }
}