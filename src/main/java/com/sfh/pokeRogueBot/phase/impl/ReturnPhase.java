package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class ReturnPhase extends AbstractPhase implements Phase {

    public static final String NAME = "ReturnPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if(gameMode == GameMode.EGG_HATCH_SCENE){
            return new PhaseAction[]{
                    this.waitBriefly
            };
        }

        throw new NotSupportedException("GameMode not supported for ReturnPhase: " + gameMode);
    }
}
