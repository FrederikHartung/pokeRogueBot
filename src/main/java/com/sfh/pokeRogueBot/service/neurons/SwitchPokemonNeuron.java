package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.decisions.SwitchDecision;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
public class SwitchPokemonNeuron {

    private SwitchPokemonNeuron() {
    }

    public static SwitchDecision getFaintedPokemonSwitchDecision(WaveDto waveDto) {
        Pokemon[] team = waveDto.getWavePokemon().getPlayerParty();
        if(!waveDto.isDoubleFight()) {
            for (int i = 0; i < team.length; i++) {
                if (team[i].getHp() != 0) {
                    log.info("Switching to pokemon: " + team[i].getName() + " on index: " + i + " with name: " + team[i].getName());
                    return new SwitchDecision(i, team[i].getName(), 0, 0);
                }
            }
        }
        else if(team.length >= 3){
            for (int i = 2; i < team.length; i++) {
                if (team[i].getHp() != 0) {
                    log.info("Switching to pokemon: " + team[i].getName() + " on index: " + i + " with name: " + team[i].getName());
                    return new SwitchDecision(i, team[i].getName(), 0, 0);
                }
            }
        }

        throw new IllegalStateException("No pokemon to switch to");
    }

    /**
     * This method returns the index of the pokemon with the best type advantage against the enemy pokemon
     * @return the index of the pokemon with the best type advantage against the enemy pokemon
     */
    public static SwitchDecision getSwitchDecision(WaveDto waveDto) {

        WavePokemon wave = waveDto.getWavePokemon();
        Pokemon[] playerParty = wave.getPlayerParty();

        //in single fight, skipp first, in double fight, skip first two
        int startIndexOfPartyPokemons = waveDto.isDoubleFight() ? 2 : 1;

        List<SwitchDecision> switchDecisions = new LinkedList<>();
        for(int i = startIndexOfPartyPokemons; i < playerParty.length; i++){
            Pokemon playerPokemon = playerParty[i];

            if(null == playerPokemon){
                continue;
            }

            if(playerParty[i].getHp() > 0){
                switchDecisions.add(new SwitchDecision(i, playerPokemon.getName(), 0, 0));
            }
        }

        if(!switchDecisions.isEmpty()){
            return switchDecisions.get(0);
        }

        return null;
    }
}
