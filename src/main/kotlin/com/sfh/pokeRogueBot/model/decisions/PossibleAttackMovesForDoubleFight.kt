package com.sfh.pokeRogueBot.model.decisions

data class PossibleAttackMovesForDoubleFight(
    val chosenFinisher1: ChosenAttackMove?,
    val chosenFinisher2: ChosenAttackMove?,
    val maxDmgMove1: ChosenAttackMove?,
    val maxDmgMove2: ChosenAttackMove?
)