package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class SummonPhase extends AbstractPhase implements Phase {

    @Override
    public String getPhaseName() {
        return Phase.SUMMON_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        return new PhaseAction[]{
                this.pressSpace,
                this.waitForTextRenderAction
        };
    }
}
