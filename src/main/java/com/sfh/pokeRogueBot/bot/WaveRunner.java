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
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.JavascriptException;
import org.openqa.selenium.NoSuchWindowException;
import org.openqa.selenium.remote.UnreachableBrowserException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class WaveRunner {

    public static final int WAIT_TIME_IF_WAVE_RUNNER_IS_NOT_ACTIVE = 10000;

    private final JsService jsService;
    private final PhaseProcessor phaseProcessor;
    private final Brain brain;
    private final PhaseProvider phaseProvider;
    private final WaitingService waitingService;

    @Setter
    private boolean active;

    public WaveRunner(
            JsService jsService,
            PhaseProcessor phaseProcessor,
            Brain brain,
            PhaseProvider phaseProvider,
            WaitingService waitingService,
            @Value("${bot.startBotOnStartup}") boolean startBotOnStartup
    ) {
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.brain = brain;
        this.phaseProvider = phaseProvider;
        this.waitingService = waitingService;
        this.active = startBotOnStartup;
    }

    public void handlePhaseInWave(RunProperty runProperty) {

        if(!active){
            log.debug("WaveRunner is not active, skipping phase handling");
            waitingService.sleep(WAIT_TIME_IF_WAVE_RUNNER_IS_NOT_ACTIVE);
            return;
        }

        try{
            String phaseAsString = jsService.getCurrentPhaseAsString();
            Phase phase = phaseProvider.fromString(phaseAsString);
            GameMode gameMode = jsService.getGameMode();

            if (null != phase && gameMode != GameMode.UNKNOWN) {
                log.debug("phase detected: " + phase.getPhaseName() + ", gameMode: " + gameMode);
                phaseProcessor.handlePhase(phase, gameMode);
                brain.memorize(phase.getPhaseName());
            } else if (null == phase && gameMode == GameMode.MESSAGE) {
                log.warn("no known phase detected, phaseAsString: " + phaseAsString + " , but gameMode is MESSAGE");
                phaseProcessor.handlePhase(phaseProvider.fromString(MessagePhase.NAME), gameMode);
                brain.memorize(MessagePhase.NAME);
            } else {
                log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , gameMode: " + gameMode);
                throw new UnsupportedPhaseException(phaseAsString, gameMode);
            }
        }
        catch (JavascriptException | NoSuchWindowException | UnreachableBrowserException e){
            log.error("Unexpected error, quitting app: " + e.getMessage());
            System.exit(1);
        }
        catch (Exception e){
            log.error("Error in WaveRunner, trying to save and quit to title, error: " + e.getMessage(), e);
            runProperty.setStatus(RunStatus.ERROR);
            saveAndQuit(runProperty, e.getClass().getSimpleName());
        }
    }

    /**
     * if save and quit is executed, the title menu should be reached.
     * if not, the app should be reloaded
     * @param runProperty to set the runstatus to reload app if needed
     * @param lastExceptionType the last exception type that occurred
     */
    public void saveAndQuit(RunProperty runProperty, String lastExceptionType) {
        try{
            Phase phase = phaseProvider.fromString(ReturnToTitlePhase.NAME);
            if(phase instanceof ReturnToTitlePhase returnToTitlePhase) {
                returnToTitlePhase.setLastExceptionType(lastExceptionType);
                log.debug("handling ReturnToTitlePhase");
                phaseProcessor.handlePhase(returnToTitlePhase, GameMode.TITLE);
            }
            waitingService.waitEvenLonger(); // wait for render title
            String phaseAsString = jsService.getCurrentPhaseAsString();
            if(phaseAsString.equals(TitlePhase.NAME)){
                log.debug("we are in title phase, saving and quitting worked");
                return;
            }
            else{
                log.error("unable to save and quit, we are not in title phase");
            }
        }
        catch (Exception e){
            log.error("unable to save and quit: " + e.getMessage());
        }

        runProperty.setStatus(RunStatus.RELOAD_APP);
    }
}
