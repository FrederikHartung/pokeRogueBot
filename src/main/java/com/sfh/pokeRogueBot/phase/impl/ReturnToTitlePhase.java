package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ReturnToTitlePhase extends AbstractPhase implements Phase {

    public static final String NAME = "ReturnToTitlePhase";

    private final JsService jsService;

    public ReturnToTitlePhase(JsService jsService) {
        this.jsService = jsService;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        if(gameMode != GameMode.MENU){
            log.debug("found game mode in ReturnToTitlePhase: {}, trying to open menu", gameMode);
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
        else{
            log.debug("found menu in ReturnToTitlePhase, trying to save and quit");
            boolean setCursorSuccess = jsService.setMenuCursorToSaveAndQuit();
            if(setCursorSuccess) {
                return new PhaseAction[]{ //save and quit to title
                        waitAction,
                        pressSpace
                };
            }
            else {
                throw new IllegalStateException("Could not set cursor to save and quit in menu");
            }
        }

    }

}
