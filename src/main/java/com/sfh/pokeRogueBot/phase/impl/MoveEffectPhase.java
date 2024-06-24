package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class MoveEffectPhase extends AbstractPhase implements Phase {

    public static final String NAME = "MoveEffectPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    waitAction //todo: check if this is correct or if space needs to be pressed
            };
        } else if (gameMode == GameMode.PARTY) { //todo: add handle if a enemy move forces the player to switch pokemon
            return new PhaseAction[]{
                    this.waitAction
            };
        }

        throw new NotSupportedException("GameMode not supported for MoveEffectPhase: " + gameMode);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 100;
    }

}
