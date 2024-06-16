package com.sfh.pokeRogueBot.model.run;

import lombok.Data;

@Data
public class AttackDecisionForDoubleFight implements AttackDecision {

    private final AttackDecisionForPokemon pokemon1;
    private final AttackDecisionForPokemon pokemon2;
}
