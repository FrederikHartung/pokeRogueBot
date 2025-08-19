package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.poke.Species;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import com.sfh.pokeRogueBot.neurons.DamageCalculatingNeuron;
import com.sfh.pokeRogueBot.neurons.SwitchPokemonNeuron;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SwitchPokemonNeuronTest {

    SwitchPokemonNeuron switchPokemonNeuron;
    DamageCalculatingNeuron damageCalculatingNeuron;

    WaveDto waveDto;
    WavePokemon wavePokemon;
    Pokemon[] playerParty;
    Pokemon[] enemyParty;

    Pokemon playerPokemon1;
    Pokemon playerPokemon2;
    Pokemon playerPokemon3;

    Species player1Species;
    Species player2Species;
    Species player3Species;

    Pokemon enemyPokemon1;

    Species enemy1Species;

    @BeforeEach
    void setUp() {

        damageCalculatingNeuron = new DamageCalculatingNeuron();
        SwitchPokemonNeuron objToSpy = new SwitchPokemonNeuron(damageCalculatingNeuron);
        switchPokemonNeuron = spy(objToSpy);

        waveDto = new WaveDto();
        waveDto.setDoubleFight(false);
        playerParty = new Pokemon[6];
        enemyParty = new Pokemon[6];
        wavePokemon = new WavePokemon();
        wavePokemon.setEnemyParty(enemyParty);
        wavePokemon.setPlayerParty(playerParty);
        waveDto.setWavePokemon(wavePokemon);

        playerPokemon1 = Pokemon.Companion.createDefault();
        playerPokemon1.setName("pokemon1");
        playerParty[0] = playerPokemon1;
        player1Species = Species.Companion.createDefault();
        playerPokemon1.setSpecies(player1Species);
        player1Species.setType1(PokeType.GRASS);

        playerPokemon2 = Pokemon.Companion.createDefault();
        playerPokemon2.setName("pokemon2");
        playerParty[1] = playerPokemon2;
        player2Species = Species.Companion.createDefault();
        playerPokemon2.setSpecies(player2Species);
        player2Species.setType1(PokeType.ELECTRIC);
        playerPokemon2.setHp(20);

        playerPokemon3 = Pokemon.Companion.createDefault();
        playerPokemon3.setName("pokemon3");
        playerParty[2] = playerPokemon3;
        player3Species = Species.Companion.createDefault();
        playerPokemon3.setSpecies(player3Species);
        player3Species.setType1(PokeType.WATER);
        playerPokemon3.setHp(30);

        enemyPokemon1 = Pokemon.Companion.createDefault();
        enemyPokemon1.setName("EnemyPokemon1");
        enemyParty[0] = enemyPokemon1;
        enemyPokemon1.setHp(40);
        enemy1Species = Species.Companion.createDefault();
        enemy1Species.setType1(PokeType.FIRE);
        enemyPokemon1.setSpecies(enemy1Species);
    }

    @Test
    void in_single_fight_the_index_of_the_first_pokemon_is_ignored(){
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        assertNotNull(switchDecision);
        int indexToSwitchTo = switchDecision.getIndex();
        assertTrue(indexToSwitchTo >= 1 && indexToSwitchTo < 6);
    }

    @Test
    void fainted_pokemons_are_skipped(){
        playerPokemon2.setHp(0);
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        assertNotNull(switchDecision);
        int indexToSwitchTo = switchDecision.getIndex();
        assertEquals(2, indexToSwitchTo);
    }

    @Test
    void in_double_fight_the_first_two_pokemons_are_skipped(){
        waveDto.setDoubleFight(true);
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        assertNotNull(switchDecision);
        int indexToSwitchTo = switchDecision.getIndex();
        assertEquals(2, indexToSwitchTo);
    }

    @Test
    void a_pokemon_with_good_type_advantage_is_chosen(){
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        assertNotNull(switchDecision);
        assertEquals(2, switchDecision.getIndex());
    }

    @Test
    void no_switch_in_double_fight(){
        waveDto.setDoubleFight(true);

        assertFalse(switchPokemonNeuron.shouldSwitchPokemon(waveDto));
    }

    @Test
    void switch_player_pokemon_to_a_better_type_matching(){
        player1Species.setType1(PokeType.GRASS);
        enemy1Species.setType1(PokeType.FIRE);
        player2Species.setType1(PokeType.ELECTRIC);
        player3Species.setType1(PokeType.WATER);

        assertTrue(switchPokemonNeuron.shouldSwitchPokemon(waveDto));
    }

    @Test
    void dont_switch_player_pokemon_when_type_matching_is_good(){
        player1Species.setType1(PokeType.FIRE);
        enemy1Species.setType1(PokeType.GRASS);
        player2Species.setType1(PokeType.ELECTRIC);
        player3Species.setType1(PokeType.WATER);

        assertFalse(switchPokemonNeuron.shouldSwitchPokemon(waveDto));
    }

    @Test
    void if_the_enemy_party_is_empty_the_next_player_pokemon_is_switched_in(){
        wavePokemon.setEnemyParty(new Pokemon[0]);
        SwitchDecision switchDecision = switchPokemonNeuron.getBestSwitchDecision(waveDto, false);
        assertNotNull(switchDecision);
        verify(switchPokemonNeuron, times(1)).getNextPokemon(playerParty, false);
        assertEquals(1, switchDecision.getIndex());
    }
}