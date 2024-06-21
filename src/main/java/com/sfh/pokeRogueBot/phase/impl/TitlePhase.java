package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class TitlePhase extends AbstractPhase implements Phase {

    public static final String NAME = "TitlePhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.TITLE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }
        else if(gameMode == GameMode.MESSAGE){
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("TitlePhase does not support game mode: " + gameMode);
    }
}
