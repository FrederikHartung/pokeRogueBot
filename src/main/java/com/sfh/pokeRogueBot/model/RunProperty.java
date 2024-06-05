package com.sfh.pokeRogueBot.model;

import com.sfh.pokeRogueBot.model.poke.Pokemon;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RunProperty {

    private final int runNumber;
    private final Pokemon[] team = new Pokemon[6];

    private int currentRoundNr = 1;
    private boolean isRunLost = false;

    public RunProperty(int runNumber) {
        this.runNumber = runNumber;
    }
}
