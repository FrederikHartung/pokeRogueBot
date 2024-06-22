package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class ReturnToTitlePhase extends AbstractPhase implements Phase {

    public static final String NAME = "ReturnToTitlePhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        return new PhaseAction[]{
                pressBackspace,
                waitAction,
                pressBackspace,
                waitAction,
                pressBackspace,
                waitAction, //close all open windows
                pressEscape,
                waitAction,
                pressArrowUp, // now on save and quit
                waitAction,
                pressSpace
        };
    }

}
