package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class AttemptCapturePhase extends AbstractPhase implements Phase {

    public static final String NAME = "AttemptCapturePhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.CONFIRM) { //todo: release the pokemon with the lowest level

            return new PhaseAction[]{ //don't take captured wild pokemons
                    this.waitBriefly,
                    this.pressArrowDown,
                    this.waitBriefly,
                    this.pressSpace
            };
        } else if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("GameMode " + uiMode + " is not supported in " + NAME);
    }

    @Override
    public int getWaitAfterStage2x() {
        return 1000;
    }

}
