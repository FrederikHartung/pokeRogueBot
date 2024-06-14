package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SwitchPokemonNeuron {

    //what to do?
    //1. check if the own pokemon is fainted -> get next pokemon
    private final JsService jsService;

    public SwitchPokemonNeuron(JsService jsService) {
        this.jsService = jsService;
    }
}
