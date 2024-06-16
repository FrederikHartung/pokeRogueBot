package com.sfh.pokeRogueBot.model.run;

import lombok.Data;

@Data
public class AttackDecisionForDoubleFight {

    private final AttackDecision maxDmgPokemon1;
    private final AttackDecision maxDmgPokemon2;
    private final AttackDecision finisherPokemon1;
    private final AttackDecision finisherPokemon2;
}
