package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class ModifierRewardPhase extends AbstractPhase implements Phase {

    public static final String NAME = "ModifierRewardPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.MESSAGE || uiMode == UiMode.EGG_HATCH_SCENE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("GameMode not supported for ModifierRewardPhase: " + uiMode);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }
}
