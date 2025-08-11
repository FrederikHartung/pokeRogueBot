package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class SwitchBiomePhase extends AbstractPhase implements Phase {

    public static final String NAME = "SwitchBiomePhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.EGG_HATCH_SCENE || uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitLonger
            };
        }

        throw new NotSupportedException("SwitchBiomePhase does not support GameMode: " + uiMode);
    }
}
