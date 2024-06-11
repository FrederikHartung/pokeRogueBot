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
        while (runProperty.getStatus() == RunStatus.ONGOING) {

            boolean handledEncounterPhase = handePhaseIfPresent(phaseProvider.getEncounterPhase());
            if(handledEncounterPhase){
                runProperty.setFightOngoing(true);
                continue;
            }

            boolean handledCommandPhase = handePhaseIfPresent(phaseProvider.getCommandPhase());
            if(handledCommandPhase){
                continue;
            }

            //current phase not detected or not implemented yet => wait & try again
            if(!runProperty.isPhaseNotDetected()){
                runProperty.setPhaseNotDetected(true);
                waitingService.waitEvenLongerForRender();
            }
            else {
                String currentPhase = jsService.getCurrentPhase();
                GameMode gameMode = jsService.getGameMode();
                throw new UnsupportedPhaseException(currentPhase, gameMode);
            }
        }
    }

    private boolean handePhaseIfPresent(Phase phase) throws Exception {
        String currentPhase = jsService.getCurrentPhase();
        GameMode gameMode = jsService.getGameMode();
        if(null != currentPhase && gameMode == phase.getExpectedGameMode() && currentPhase.equals(phase.getPhaseName())){
            log.debug("phase detected: " + phase.getPhaseName());
            phaseProcessor.handlePhase(phase);
            return true;
        }

        return false;
    }
}
