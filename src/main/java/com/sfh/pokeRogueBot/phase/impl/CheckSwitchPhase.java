package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class CheckSwitchPhase extends AbstractPhase implements Phase {

    @Override
    public String getPhaseName() {
        return Phase.CHECK_SWITCH_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.CONFIRM){
            return new PhaseAction[]{
                    this.pressArrowDown, //todo: dont switch pokemon
                    this.waitAction,
                    this.pressSpace
            };
        } else if (gameMode == GameMode.MESSAGE) {
            return new PhaseAction[]{
                    this.waitForTextRenderAction
            };
        } else {
            throw new NotSupportedException("GameMode not supported: " + gameMode);
        }
    }
}