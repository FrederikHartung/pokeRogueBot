package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

import javax.print.attribute.standard.MediaSize;

@Component
public class LoginPhase extends AbstractPhase implements Phase {

    private static final String NAME = "LoginPhase";

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.LOADING){
            return new PhaseAction[]{
                    this.waitForTextRenderAction
            };
        }

        throw new NotSupportedException("Gamemode " + gameMode + "not supported in " + NAME);
    }
}
