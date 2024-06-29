package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * There is no ReturnToTitlePhase in the original game. This is a custom phase that is used to return to the title screen after an error.
 */
@Slf4j
@Component
public class ReturnToTitlePhase extends AbstractPhase implements Phase {

    public static final String NAME = "ReturnToTitlePhase";

    private final JsService jsService;
    private final ScreenshotClient screenshotClient;

    @Setter
    private String lastExceptionType = "";

    public ReturnToTitlePhase(JsService jsService, ScreenshotClient screenshotClient) {
        this.jsService = jsService;
        this.screenshotClient = screenshotClient;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {

        if(gameMode == GameMode.TITLE){

            screenshotClient.takeTempScreenshot("error_" + lastExceptionType); //take screenshot for debugging
            log.debug("Trying to save and quit");
            boolean saveAndQuitSuccessful = jsService.saveAndQuit();
            if(saveAndQuitSuccessful) {
                return new PhaseAction[]{ //wait for render
                        waitEvenLonger
                };
            }
            else {
                return new PhaseAction[]{ //fallback, so no loop happens
                        waitBriefly
                };
            }
        }
        else{
            throw new NotSupportedException("GameMode is not supported in ReturnToTitlePhase: " + gameMode);
        }
    }

}
