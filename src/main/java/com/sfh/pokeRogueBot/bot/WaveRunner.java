package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.phase.impl.ReturnToTitlePhase;
import com.sfh.pokeRogueBot.phase.impl.TitlePhase;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class WaveRunner {

    private final JsService jsService;
    private final PhaseProcessor phaseProcessor;
    private final Brain brain;
    private final PhaseProvider phaseProvider;

    public WaveRunner(
            JsService jsService,
            PhaseProcessor phaseProcessor,
            Brain brain,
            PhaseProvider phaseProvider
    ) {
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.brain = brain;
        this.phaseProvider = phaseProvider;
    }

    public void handlePhaseInWave(RunProperty runProperty) {

        try{
            String phaseAsString = jsService.getCurrentPhaseAsString();
            Phase phase = phaseProvider.fromString(phaseAsString);
            GameMode gameMode = jsService.getGameMode();

            if(null != phase && phase.getPhaseName().equals(TitlePhase.NAME)){
                if(runProperty.getStatus() == RunStatus.STARTING){
                    runProperty.setStatus(RunStatus.WAVE_FIGHTING);
                }
                else if(runProperty.getStatus() == RunStatus.WAVE_FIGHTING){
                    runProperty.setStatus(RunStatus.LOST);
                    return;
                }
            }

            if (null != phase && gameMode != GameMode.UNKNOWN) {
                log.debug("phase detected: " + phase.getPhaseName() + ", gameMode: " + gameMode);
                phaseProcessor.handlePhase(phase, gameMode);
                brain.memorizePhase(phase.getPhaseName());
            } else if (null == phase && gameMode == GameMode.MESSAGE) {
                log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , but gameMode is MESSAGE");
                phaseProcessor.handlePhase(phaseProvider.fromString(MessagePhase.NAME), gameMode);
                brain.memorizePhase(MessagePhase.NAME);
            } else {
                log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , gameMode: " + gameMode);
                throw new UnsupportedPhaseException(phaseAsString, gameMode);
            }
        }
        catch (Exception e){
            log.error("Error in WaveRunner, trying to save and quit to title", e);
            runProperty.setStatus(RunStatus.ERROR);
            saveAndQuit(runProperty);
        }
    }

    private void saveAndQuit(RunProperty runProperty) {
        try{
            Phase returnToTitlePhase = phaseProvider.fromString(ReturnToTitlePhase.NAME);
            phaseProcessor.handlePhase(returnToTitlePhase, GameMode.TITLE);
        }
        catch (Exception e){
            log.error("unable to save and quit", e);
            runProperty.setStatus(RunStatus.CRITICAL_ERROR);
        }
    }
}
