package com.sfh.pokeRogueBot.model.run;

import lombok.Data;

import javax.annotation.Nullable;

@Data
public class PossibleAttackMovesForDoubleFight {

    @Nullable
    private final ChosenAttackMove chosenFinisher1;
    @Nullable
    private final ChosenAttackMove chosenFinisher2;
    @Nullable
    private final ChosenAttackMove maxDmgMove1;
    @Nullable
    private final ChosenAttackMove maxDmgMove2;
}
