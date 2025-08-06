package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class EncounterPhase extends AbstractPhase implements Phase {

    public static final String NAME = "EncounterPhase";

    @Override
    public int getWaitAfterStage2x() {
        return 500;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {
        if (gameMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        } else if (gameMode == UiMode.TITLE || gameMode == UiMode.STARTER_SELECT) {
            return new PhaseAction[]{
                    this.waitBriefly
            };
        }

        throw new NotSupportedException("GameMode not supported in EncounterPhase: " + gameMode);
    }
}
