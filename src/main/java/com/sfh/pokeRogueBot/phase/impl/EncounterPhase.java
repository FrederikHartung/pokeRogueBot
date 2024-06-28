package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class EncounterPhase extends AbstractPhase implements Phase {

    public static final String NAME = "EncounterPhase";

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if(gameMode == GameMode.TITLE || gameMode == GameMode.STARTER_SELECT){
            return new PhaseAction[]{
                    this.waitAction
            };
        }

        throw new NotSupportedException("GameMode not supported in EncounterPhase: " + gameMode);
    }
}
