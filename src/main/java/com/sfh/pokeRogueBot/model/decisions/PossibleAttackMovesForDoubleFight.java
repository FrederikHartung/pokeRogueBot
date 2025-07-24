package com.sfh.pokeRogueBot.model.decisions;

import lombok.Data;


@Data
public class PossibleAttackMovesForDoubleFight {

    private final ChosenAttackMove chosenFinisher1;
    private final ChosenAttackMove chosenFinisher2;
    private final ChosenAttackMove maxDmgMove1;
    private final ChosenAttackMove maxDmgMove2;
}
