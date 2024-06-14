package com.sfh.pokeRogueBot.model;

import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RunProperty {

    // RunPropertyEntity properties
    private final int runNumber;
    private RunStatus status;
    private int roundNumber;
    private int defeatedWildPokemon;
    private int caughtPokemon;
    private int defeatedTrainer;

    //own properties
    private final Pokemon[] team = new Pokemon[6];
    private boolean isTrainerFight = false;
    private boolean isFightOngoing = false;

    public RunProperty(int runNumber) {
        this.runNumber = runNumber;
    }
}
