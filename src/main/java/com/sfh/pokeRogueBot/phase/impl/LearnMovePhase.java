package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class LearnMovePhase extends AbstractPhase implements Phase {

    public static final String NAME = "LearnMovePhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE){
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if(gameMode == GameMode.CONFIRM){
            //should pokemon learn message
            return new PhaseAction[]{ //currently don't learn new moves
                    this.pressArrowDown,
                    this.waitAction,
                    this.pressSpace, //no,
                    this.waitForTextRenderAction,
                    this.pressSpace, //confirm
            };
        }

        throw new NotSupportedException("GameMode not supported for LearnMovePhase: " + gameMode);
    }

}
