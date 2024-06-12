package com.sfh.pokeRogueBot.phase;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.actions.*;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PhaseProcessor implements ScreenshotClient {

    private final WaitingService waitingService;
    private final BrowserClient browserClient;
    private final ImageService imageService;

    public PhaseProcessor(WaitingService waitingService, BrowserClient browserClient, ImageService imageService) {
        this.waitingService = waitingService;
        this.browserClient = browserClient;
        this.imageService = imageService;
    }

    /**
     * Handles the given phase by performing the actions in the phase and waits the configured time after the phase.
     */
    public void handlePhase(Phase phase, GameMode gameMode) throws Exception {
        PhaseAction[] actionsToPerform = phase.getActionsForGameMode(gameMode);
        for (PhaseAction action : actionsToPerform) {
            handleAction(action);
        }

        waitingService.waitAfterPhase(phase);
    }

    private void handleAction(PhaseAction action) throws Exception {
        if(action instanceof PressKeyPhaseAction pressKeyPhaseAction){
            browserClient.pressKey(pressKeyPhaseAction.getKeyToPress());
        }
        else if(action instanceof WaitPhaseAction){
            waitingService.waitAfterAction();
        }
        else if(action instanceof WaitForTextRenderPhaseAction){
            waitingService.waitLongerAfterAction();
        }
        else if(action instanceof WaitForStageRenderPhaseAction){
            waitingService.waitEvenLongerForRender();
        }
        else if(action instanceof TakeScreenshotPhaseAction){
            takeScreenshot("phase");
        }
        else {
            throw new NotSupportedException("Unknown action: " + action.getClass().getSimpleName());
        }
    }

    @Override
    public void takeScreenshot(String prefix) {
        try{
            ScreenshotFilehandler.persistBufferedImage(imageService.takeScreenshot(prefix), prefix);

        }
        catch (Exception e){
            log.error("error while taking screenshot", e);
        }
    }

}
