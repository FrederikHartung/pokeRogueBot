package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import org.springframework.stereotype.Component;

@Component
public class CommandPhase extends AbstractPhase implements Phase {

    private final DecisionService decisionService;

    public CommandPhase(DecisionService decisionService) {
        this.decisionService = decisionService;
    }

    @Override
    public GameMode getExpectedGameMode() {
        return GameMode.COMMAND;
    }

    @Override
    public String getPhaseName() {
        return Phase.COMMAND_PHASE;
    }

    @Override
    public PhaseAction[] getActionsToPerform() {
        FightDecision fightDecision = decisionService.getFightDecision();
        if(fightDecision == FightDecision.ATTACK){
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitAction,
                    this.pressSpace
            };
        }

        return new PhaseAction[0];
    }
}
