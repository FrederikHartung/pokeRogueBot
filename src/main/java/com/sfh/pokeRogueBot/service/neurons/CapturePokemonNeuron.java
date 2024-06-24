package com.sfh.pokeRogueBot.service.neurons;

import com.sfh.pokeRogueBot.model.poke.Pokemon;
import org.springframework.stereotype.Component;

@Component
public class CapturePokemonNeuron {

    public boolean shouldCapturePokemon(Pokemon pokemon) {
        if(pokemon.is)
        return false;
    }
}
