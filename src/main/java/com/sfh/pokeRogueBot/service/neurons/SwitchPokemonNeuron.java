package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.poke.Pokemon;
import com.sfh.pokeRogueBot.model.run.SwitchDecision;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SwitchPokemonNeuron {

    private final JsService jsService;

    public SwitchPokemonNeuron(JsService jsService) {
        this.jsService = jsService;
    }

    public SwitchDecision getFaintedPokemonSwitchDecision() {
        WavePokemon wave = jsService.getWavePokemon();
        Pokemon[] team = wave.getPlayerParty();
        for (int i = 0; i < team.length; i++) {
            if (team[i].getHp() != 0) {
                log.info("Switching to pokemon: " + team[i].getName() + " on index: " + i);
                return new SwitchDecision(i, team[i].getName());
            }
        }

        throw new IllegalStateException("No pokemon to switch to");
    }
}
