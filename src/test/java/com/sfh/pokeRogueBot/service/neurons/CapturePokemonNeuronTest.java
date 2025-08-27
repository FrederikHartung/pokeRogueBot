package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Status;
import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.enums.PokeBallType;
import com.sfh.pokeRogueBot.model.enums.StatusEffect;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.poke.Species;
import com.sfh.pokeRogueBot.neurons.CapturePokemonNeuron;
import com.sfh.pokeRogueBot.service.javascript.JsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

class CapturePokemonNeuronTest {

    JsService jsService;
    CapturePokemonNeuron capturePokemonNeuron;

    WaveDto waveDto;
    Pokemon wildPokemon;
    Species species;
    Stats wildPokemonStats;
    Status status;
    int[] pokeballs;

    @BeforeEach
    void setUp() {
        jsService = mock(JsService.class);
        capturePokemonNeuron = new CapturePokemonNeuron(jsService);

        waveDto = mock(WaveDto.class);
        wildPokemon = Pokemon.Companion.createDefault();

        species = Species.Companion.createDefault();
        species.setCatchRate(45);
        wildPokemon.setSpecies(species);

        status = new Status(StatusEffect.NONE, 3);
        wildPokemon.setStatus(status);

        wildPokemonStats = Stats.Companion.createDefault();
        wildPokemon.setStats(wildPokemonStats);
        wildPokemonStats.setHp(20);
        wildPokemon.setHp(20);

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
        doReturn(true).when(jsService).currentBattleHasEnemyTrainer();
    }

    @Test
    void a_catchable_pokemon_should_be_captured() {
        wildPokemon.setHp(10);
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
        Stats stats = Stats.Companion.createDefault();
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

    @Test
    void a_pokemon_with_full_hp_should_not_be_catched(){
        wildPokemon.setHp(100);
        assertFalse(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void a_pokemon_with_missing_hp_should_be_catched(){
        wildPokemon.setHp(10);
        assertTrue(capturePokemonNeuron.shouldCapturePokemon(waveDto, wildPokemon));
    }

    @Test
    void getCaptureChance_for_pokeball_with_low_hp(){
        wildPokemon.setHp(5);
        wildPokemon.getStats().setHp(20);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.POKEBALL);
        assertEquals(15, result);
    }

    @Test
    void getCaptureChance_for_pokeball_with_full_hp(){
        wildPokemon.setHp(20);
        wildPokemon.getStats().setHp(20);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.POKEBALL);
        assertEquals(6, result);
    }

    @Test
    void getCaptureChance_for_pokeball_with_full_hp_and_sleeping(){
        wildPokemon.setHp(20);
        wildPokemon.getStats().setHp(20);
        status.setEffect(StatusEffect.SLEEP);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.POKEBALL);
        assertEquals(15, result);
    }

    @Test
    void getCaptureChance_for_pokeball_with_low_hp_and_sleeping(){
        wildPokemon.setHp(1);
        wildPokemon.getStats().setHp(20);
        status.setEffect(StatusEffect.SLEEP);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.POKEBALL);
        assertEquals(43, result);
    }

    @Test
    void getCaptureChance_for_ultraball_with_low_hp_and_sleeping(){
        wildPokemon.setHp(1);
        wildPokemon.getStats().setHp(20);
        status.setEffect(StatusEffect.SLEEP);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.ULTRA_BALL);
        assertEquals(85, result);
    }

    @Test
    void getCaptureChance_for_pokeball_with_low_hp_and_sleeping_and_common_pokemon(){
        wildPokemon.setHp(1);
        wildPokemon.getStats().setHp(20);
        status.setEffect(StatusEffect.SLEEP);
        species.setCatchRate(255);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.POKEBALL);
        assertEquals(100, result);
    }

    @Test
    void getCaptureChance_for_masterball_with_full_hp(){
        wildPokemon.setHp(20);
        wildPokemon.getStats().setHp(20);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.MASTER_BALL);
        assertEquals(100, result);
    }

    @Test
    void getCaptureChance_for_legendary_pokemon_with_masterball_with_full_hp(){
        wildPokemon.setHp(20);
        wildPokemon.getStats().setHp(20);
        species.setCatchRate(3);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.MASTER_BALL);
        assertEquals(100, result);
    }

    @Test
    void getCaptureChance_for_legendary_pokemon_with_ultra_ball_with_full_hp(){
        wildPokemon.setHp(300);
        wildPokemon.getStats().setHp(300);
        species.setCatchRate(3);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.ULTRA_BALL);
        assertEquals(1, result);
    }

    @Test
    void getCaptureChance_for_legendary_pokemon_with_ultra_ball_with_low_hp(){
        wildPokemon.setHp(20);
        wildPokemon.getStats().setHp(300);
        species.setCatchRate(3);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.ULTRA_BALL);
        assertEquals(2, result);
    }

    @Test
    void getCaptureChance_for_legendary_pokemon_with_rogue_ball_with_low_hp_and_paralysis(){
        wildPokemon.setHp(1);
        wildPokemon.getStats().setHp(300);
        species.setCatchRate(3);
        status.setEffect(StatusEffect.PARALYSIS);
        int result = capturePokemonNeuron.getCaptureChance(wildPokemon, PokeBallType.ROGUE_BALL);
        assertEquals(5, result);
    }
}