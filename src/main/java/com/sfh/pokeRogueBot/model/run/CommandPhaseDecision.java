package com.sfh.pokeRogueBot.model.run;

import com.sfh.pokeRogueBot.model.enums.CommandPhaseDecisionType;
import lombok.Data;

@Data
public class CommandPhaseDecision {

    private CommandPhaseDecisionType decisionType;
    private AttackDecision attackDecisionForPokemon;
    private AttackDecisionForDoubleFight attackDecisionForDoubleFight1;
    private AttackDecisionForDoubleFight attackDecisionForDoubleFight2;
    private boolean tryToCatch;

}
