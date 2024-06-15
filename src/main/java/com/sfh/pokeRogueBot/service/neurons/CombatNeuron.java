package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.browser.pokemonjson.MoveSetEntry;
import com.sfh.pokeRogueBot.model.enums.PokeType;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.AttackDecision;
import com.sfh.pokeRogueBot.model.run.Wave;
import com.sfh.pokeRogueBot.service.ImageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CombatNeuron {

    public AttackDecision getAttackDecision(Wave wave) {
        return null;
    }

    private AttackDecision getAttackDecisionForSingleFight(Wave wave) {
        Pokemon playerPokemon = wave.getWavePokemon().getPlayerTeam()[0];
        Pokemon enemyPokemon = wave.getWavePokemon().getEnemyTeam()[0];

        MoveSetEntry[] playerMoves = playerPokemon.getMoveset();
        PokeType enemyType1 = enemyPokemon.getSpecies().getType1();
        PokeType enemyType2 = enemyPokemon.getSpecies().getType2();

        for(MoveSetEntry move : playerMoves) {

        }

        return null;
    }
}
