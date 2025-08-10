package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
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
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.TARGET_SELECT) {
            return new PhaseAction[]{
                    pressSpace
            };
        } else if (uiMode == UiMode.MESSAGE) {

            return new PhaseAction[]{
                    pressSpace
            };
        }

        throw new NotSupportedException("GameMode not supported in SelectTargetPhase: " + uiMode);
    }
}
