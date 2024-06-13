package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import org.springframework.stereotype.Component;

@Component
public class SelectStarterPhase extends AbstractPhase implements Phase {

    @Override
    public String getPhaseName() {
        return Phase.SELECT_STARTER_PHASE;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.STARTER_SELECT){
            return new PhaseAction[]{
                    pressArrowRight,
                    waitAction,
                    pressSpace, //green
                    waitForTextRenderAction,
                    pressSpace, //confirm
                    waitAction,
                    pressArrowRight,
                    waitAction,
                    pressSpace, //red
                    waitForTextRenderAction,
                    pressSpace, //confirm
                    waitAction,
                    pressArrowRight,
                    waitAction,
                    pressSpace, //blue
                    waitForTextRenderAction,
                    pressSpace, //confirm
                    waitAction,
/*                    waaitForStageRenderPhaseAction, //not needed anymore? Cursor jumps to start game
                    pressArrowLeft,
                    waaitForStageRenderPhaseAction,
                    waitAction,
                    pressArrowLeft,
                    waaitForStageRenderPhaseAction,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowDown,
                    waitAction,
                    pressArrowLeft,
                    waitAction,*/
                    pressSpace, //start game
                    waitForTextRenderAction,
                    pressSpace, //start confirm
                    waitForTextRenderAction,
                    pressSpace, //chose saveslot
                    waitForTextRenderAction,
                    pressSpace, //confirm
            };
        }

        throw new NotSupportedException("gameMode not supported: " + gameMode);
    }
}
