package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.phase.actions.PhaseAction;

public class EncounterPhase extends AbstractPhase implements Phase {

    @Override
    public PhaseAction[] getActionsToPerform() {

        return new PhaseAction[]{
                this.pressSpace
        };
    }
}
