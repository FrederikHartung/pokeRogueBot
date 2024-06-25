package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.dto.WaveDto;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
public class CapturePokemonNeuron {

    private CapturePokemonNeuron() {
    }

    /**
     *
     * @return if the pokemon should be captured
     */
    public static boolean shouldCapturePokemon(WaveDto waveDto, Pokemon wildPokemon) {
        if(waveDto.isTrainerFight()){
            log.debug("can't capture: trainer fight");
            return false;
        }

        if(!waveDto.hasPokeBalls()){
            log.debug("can't capture: no pokeballs left");
            return false;
        }

        if(!waveDto.isOnlyOneEnemyLeft()){
            log.debug("can't capture: more than one enemy left");
            return false;
        }

        if(wildPokemon.isBoss()){
            boolean isBossCatchable = wildPokemon.getHp() <= ((wildPokemon.getStats().getHp() / wildPokemon.getBossSegments()));

            if(!isBossCatchable){
                log.debug("can't capture: boss is not hurt enough");
                return false;
            }
        }

        log.debug("can capture: " + wildPokemon.getName());
        return true;
    }

    public static int selectStrongestPokeball(WaveDto waveDto) {
        int[] pokeballs = waveDto.getPokeballCount();
        for(int i = pokeballs.length - 1; i >= 0; i--){
            if(pokeballs[i] > 0){
                pokeballs[i]--;
                return i;
            }
        }

        // when no poke balls are left, we should not try to capture
        return -1;
    }
}