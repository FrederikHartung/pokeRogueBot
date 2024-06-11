package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.DecisionService;
import org.springframework.stereotype.Component;

@Component
public class SelectModifierPhase  extends AbstractPhase implements Phase {

    private final DecisionService decisionService;

    public SelectModifierPhase(DecisionService decisionService) {
        this.decisionService = decisionService;
    }

    @Override
    public String getPhaseName() {
        return Phase.SELECT_MODIFIER_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MODIFIER_SELECT) {

            decisionService.getModifierToPick();
            return new PhaseAction[]{
                this.quitRunAction
            };
        }

        throw new NotSupportedException("GameMode not supported for SelectModifierPhase: " + gameMode);
    }
}
