package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class EncounterPhase extends AbstractPhase implements Phase {

    @Override
    public GameMode getExpectedGameMode() {
        return GameMode.MESSAGE;
    }

    @Override
    public String getPhaseName() {
        return Phase.ENCOUNTER_PHASE;
    }

    @Override
    public PhaseAction[] getActionsToPerform() {

        return new PhaseAction[]{
                this.pressSpace
        };
    }
}
