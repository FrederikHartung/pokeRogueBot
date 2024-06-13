package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class StatChangePhase extends AbstractPhase implements Phase {
    @Override
    public String getPhaseName() {
        return Phase.STAT_CHANGE_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    pressSpace,
            };
        }

        throw new NotSupportedException("StatChangePhase does not support GameMode: " + gameMode);
    }
}
