package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public class MessagePhase extends AbstractPhase implements Phase {

    @Override
    public String getPhaseName() {
        return Phase.MESSAGE_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.MESSAGE){
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("GameMode not supported for MessagePhase: " + gameMode);
    }
}
