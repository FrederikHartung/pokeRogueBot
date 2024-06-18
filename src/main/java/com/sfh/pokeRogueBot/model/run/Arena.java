package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.Biome;
import lombok.Data;

@Data
public class Arena {

    private Biome biome;
    private int lastTimeOfDay;
    //private WildPokemonPool pokemonPool;
}
