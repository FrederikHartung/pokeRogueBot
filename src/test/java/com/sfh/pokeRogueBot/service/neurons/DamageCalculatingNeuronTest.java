package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.Move;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Species;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import com.sfh.pokeRogueBot.model.decisions.PossibleAttackMove;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.results.DamageMultiplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DamageCalculatingNeuronTest {

    Pokemon playerPokemon;
    Species player1Species;
    Stats playerPokemonStats;

    Pokemon enemyPokemon;
    Species enemy1Species;
    Stats enemyPokemonStats;

    final Move[] playerMoves = new Move[4];
    Move playerMove1;
    Move playerMove2;
    Move playerMove3;
    Move playerMove4;

    @BeforeEach
    void setUp() {
        playerPokemon = new Pokemon();
        player1Species = new Species();
        playerPokemon.setSpecies(player1Species);
        playerPokemon.setMoveset(playerMoves);

        playerPokemonStats = new Stats();
        playerPokemon.setStats(playerPokemonStats);
        playerPokemonStats.setHp(100);
        playerPokemonStats.setAttack(30);
        playerPokemonStats.setDefense(30);
        playerPokemonStats.setSpecialAttack(30);
        playerPokemonStats.setSpecialDefense(30);
        playerPokemonStats.setSpeed(30);

        playerMove1 = new Move();
        playerMoves[0] = playerMove1;
        playerMove1.setPPLeft(10);
        playerMove1.setUsable(true);
        playerMove1.setAccuracy(100);
        playerMove1.setType(PokeType.NORMAL);
        playerMove1.setName("Attack1");
        playerMove1.setPower(40);

        playerMove2 = new Move();
        playerMoves[1] = playerMove2;
        playerMove2.setPPLeft(15);
        playerMove2.setUsable(true);
        playerMove2.setAccuracy(100);
        playerMove2.setType(PokeType.NORMAL);
        playerMove2.setName("Attack2");
        playerMove2.setPower(50);

        playerMove3 = new Move();
        playerMoves[2] = playerMove3;
        playerMove3.setPPLeft(20);
        playerMove3.setUsable(true);
        playerMove3.setAccuracy(100);
        playerMove3.setType(PokeType.NORMAL);
        playerMove3.setName("Attack3");
        playerMove3.setPower(60);

        playerMove4 = new Move();
        playerMoves[3] = playerMove4;
        playerMove4.setPPLeft(25);
        playerMove4.setUsable(true);
        playerMove4.setAccuracy(100);
        playerMove4.setType(PokeType.NORMAL);
        playerMove4.setName("Attack4");
        playerMove4.setPower(70);

        enemyPokemon = new Pokemon();
        enemy1Species = new Species();
        enemyPokemon.setSpecies(enemy1Species);
        enemy1Species.setType1(PokeType.NORMAL);
        enemy1Species.setType2(PokeType.FLYING);
        enemyPokemonStats = new Stats();

        enemyPokemon.setStats(enemyPokemonStats);
        enemyPokemonStats.setHp(100);
        enemyPokemonStats.setAttack(30);
        enemyPokemonStats.setDefense(30);
        enemyPokemonStats.setSpecialAttack(30);
        enemyPokemonStats.setSpecialDefense(30);
        enemyPokemonStats.setSpeed(30);
    }

    @Test
    void damage_multiplier_for_grass_on_fire(){
        playerPokemon.getSpecies().setType1(PokeType.GRASS);
        enemy1Species.setType1(PokeType.FIRE);
        enemy1Species.setType2(null);
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

    @Test
    void a_move_which_is_null_is_not_processed(){
        playerMoves[0] = null;
        List<PossibleAttackMove> possibleAttackMoves = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon);
        assertNotNull(possibleAttackMoves);
        assertEquals(3, possibleAttackMoves.size());
        assertEquals("Attack2", possibleAttackMoves.get(0).getAttackName());
        assertEquals("Attack3", possibleAttackMoves.get(1).getAttackName());
        assertEquals("Attack4", possibleAttackMoves.get(2).getAttackName());
    }

    @Test
    void a_move_which_is_not_usable_is_not_processed(){
        playerMove2.setUsable(false);
        List<PossibleAttackMove> possibleAttackMoves = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon);
        assertNotNull(possibleAttackMoves);
        assertEquals(3, possibleAttackMoves.size());
        assertEquals("Attack1", possibleAttackMoves.get(0).getAttackName());
        assertEquals("Attack3", possibleAttackMoves.get(1).getAttackName());
        assertEquals("Attack4", possibleAttackMoves.get(2).getAttackName());
    }

    @Test
    void a_move_which_has_no_pp_left_is_not_processed(){
        playerMove3.setPPLeft(0);
        List<PossibleAttackMove> possibleAttackMoves = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon);
        assertNotNull(possibleAttackMoves);
        assertEquals(3, possibleAttackMoves.size());
        assertEquals("Attack1", possibleAttackMoves.get(0).getAttackName());
        assertEquals("Attack2", possibleAttackMoves.get(1).getAttackName());
        assertEquals("Attack4", possibleAttackMoves.get(2).getAttackName());
    }

    @Test
    void a_move_with_power_less_than_zero_does_no_damage(){
        playerMove1.setPower(-1);
        List<PossibleAttackMove> possibleAttackMoves = DamageCalculatingNeuron.getPossibleAttackMoves(playerPokemon, enemyPokemon);
        assertNotNull(possibleAttackMoves);
        assertEquals(4, possibleAttackMoves.size());
        assertEquals(0, possibleAttackMoves.get(0).getMinDamage());
        assertEquals(0, possibleAttackMoves.get(0).getMaxDamage());
    }
}