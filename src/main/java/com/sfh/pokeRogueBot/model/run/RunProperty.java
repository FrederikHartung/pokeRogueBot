package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RunProperty {

    private int runNumber;
    private RunStatus status;
    private int waveIndex;
    private int defeatedWildPokemon;
    private int caughtPokemon;
    private int defeatedTrainer;
}
