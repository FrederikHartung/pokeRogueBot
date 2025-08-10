package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class MessagePhase extends AbstractPhase implements Phase {

    public static final String NAME = "MessagePhase";

    @Override
    public int getWaitAfterStage2x() {
        return 100;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace,
                    this.waitBriefly
            };
        } else if (uiMode == UiMode.COMMAND || uiMode == UiMode.EGG_HATCH_SCENE || uiMode == UiMode.MODIFIER_SELECT) {
            return new PhaseAction[]{
                    this.waitLonger
            };
        }

        throw new NotSupportedException("GameMode not supported for MessagePhase: " + uiMode);
    }
}
