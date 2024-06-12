package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SimpleFightConfig implements Config {

    private final RunPropertyService runPropertyService;
    private final JsService jsService;
    private final PhaseProcessor phaseProcessor;
    private final PhaseProvider phaseProvider;
    private final WaitingService waitingService;

    public SimpleFightConfig(RunPropertyService runPropertyService, JsService jsService, PhaseProcessor phaseProcessor, PhaseProvider phaseProvider, WaitingService waitingService) {
        this.runPropertyService = runPropertyService;
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.phaseProvider = phaseProvider;
        this.waitingService = waitingService;
    }

    @Override
    public void applay() throws Exception {

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.ONGOING);
        runPropertyService.save(runProperty);
        startWaveFightingMode(runProperty);

        log.info("finished run, status: " + runProperty.getStatus());
    }

    private void startWaveFightingMode(RunProperty runProperty) throws Exception {
        log.debug("starting wave fighting mode");
        while (runProperty.getStatus() == RunStatus.ONGOING) {

            String phaseAsString = jsService.getCurrentPhaseAsString();
            Phase phase = phaseProvider.fromString(phaseAsString);
            GameMode gameMode = jsService.getGameMode();

            if(handePhaseIfPresent(phase, gameMode)){
                runProperty.setLastPhaseNotDetected(false);
                continue;
            }

            retryOrThrow(runProperty, gameMode);
        }
    }

    private boolean handePhaseIfPresent(Phase phase, GameMode gameMode) throws Exception {
        if(null != phase && gameMode != GameMode.UNKNOWN){
            log.debug("phase detected: " + phase.getPhaseName() + ", gameMode: " + gameMode);
            phaseProcessor.handlePhase(phase, gameMode);
            return true;
        }
        else if(null == phase && gameMode == GameMode.MESSAGE) {
            String phaseAsString = jsService.getCurrentPhaseAsString();
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , but gameMode is MESSAGE");
            phaseProcessor.handlePhase(phaseProvider.getMessagePhase(), gameMode);
            return true;
        }
        else{
            String phaseAsString = jsService.getCurrentPhaseAsString();
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , gameMode: " + gameMode);
        }

        return false;
    }

    private void retryOrThrow(RunProperty runProperty, GameMode gameMode) throws UnsupportedPhaseException {
        //current phase not detected or not implemented yet => wait & try again
        if(!runProperty.isLastPhaseNotDetected()){
            runProperty.setLastPhaseNotDetected(true);
            log.debug("last phase not detected, retrying...");
            waitingService.waitEvenLongerForRender();
        }
        else {
            String phaseAsString = jsService.getCurrentPhaseAsString();
            phaseProcessor.takeScreenshot("error");
            throw new UnsupportedPhaseException(phaseAsString, gameMode);
        }
    }
}
