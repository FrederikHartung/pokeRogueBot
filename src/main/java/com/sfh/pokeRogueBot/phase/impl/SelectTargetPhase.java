package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class SelectTargetPhase extends AbstractPhase implements Phase {

    public static final String NAME = "SelectTargetPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.TARGET_SELECT) {
            return new PhaseAction[]{
                    waitForTextRenderAction //todo: choose correct target
            };
        } else if (gameMode == GameMode.MESSAGE) {

            return new PhaseAction[]{
                    pressSpace
            };
        }

        throw new NotSupportedException("GameMode not supported in SelectTargetPhase: " + gameMode);
    }
}
