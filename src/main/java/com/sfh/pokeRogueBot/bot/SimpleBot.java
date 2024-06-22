package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.CannotCatchTrainerPokemonException;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.phase.impl.TitlePhase;
import com.sfh.pokeRogueBot.service.Brain;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.JavascriptException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

/**
 * The main bot class that controls the flow of the bot.
 * On start, the Temp folder is cleared and the bot navigates to the target URL.
 * After navigating to the target url, the bot continues with a save game or starts a new run.
 * If a run is lost, the bot reloads the page and starts a new run.
 * If an error occurs, the bot logs the error, saves the game and ends the run. After that, the bot starts a new run on a new save slot.
 * The bot enters a loop and starts new runs till the app is closed or all save game slots are full.
 * The bot can be configured to run a specific number of runs before stopping or endless with maxRunsTillShutdown = -1.
 */

@Slf4j
@Component
public class SimpleBot implements Bot {

    private final JsService jsService;
    private final PhaseProcessor phaseProcessor;
    private final FileManager fileManager;
    private final BrowserClient browserClient;
    private final Brain brain;
    private final RunPropertyService runPropertyService;
    private final WaveRunner waveRunner;

    private final String targetUrl;
    private final int maxRetriesPerRun;
    private final int backoffPerRetry;
    private final int maxRunsTillShutdown;

    private int runNumber = 1;

    public SimpleBot(
            JsService jsService,
            PhaseProcessor phaseProcessor,
            FileManager fileManager,
            BrowserClient browserClient,
            Brain brain,
            RunPropertyService runPropertyService,
            WaveRunner waveRunner,
            @Value("${browser.target-url}") String targetUrl,
            @Value("${bot.maxRetriesPerRun}") int maxRetriesPerRun,
            @Value("${bot.backoffPerRetry}") int backoffPerRetry,
            @Value("${bot.maxRunsTillShutdown}") int maxRunsTillShutdown
    ) {
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.fileManager = fileManager;
        this.browserClient = browserClient;
        this.brain = brain;
        this.runPropertyService = runPropertyService;
        this.waveRunner = waveRunner;

        this.targetUrl = targetUrl;
        this.maxRetriesPerRun = maxRetriesPerRun;
        this.backoffPerRetry = backoffPerRetry;
        this.maxRunsTillShutdown = maxRunsTillShutdown;
    }

    @Override
    public void start() {
        fileManager.deleteTempData();
        browserClient.navigateTo(targetUrl);

        while (runNumber <= maxRunsTillShutdown || maxRunsTillShutdown == -1) {
            try{
                startRun();
                log.debug("run finished, starting new run");
                runNumber++;
            }
            catch (IllegalStateException e){
                log.error(e.getMessage());
                return;
            }
        }

        log.debug("maxRunsTillShutdown reached, shutting down");
    }

    private void startRun() throws IllegalStateException {

        RetryTemplate retryTemplate = new RetryTemplateBuilder()
                .retryOn(UnsupportedPhaseException.class)
                .retryOn(JavascriptException.class)
                .maxAttempts(maxRetriesPerRun)
                .fixedBackoff(backoffPerRetry)
                .build();

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.STARTING);
        jsService.init();
        brain.setRunProperty(runProperty);
        brain.clearShortTermMemory();

        log.debug("run " + runProperty.getRunNumber() + ", starting wave fighting mode");
        while (runProperty.getStatus() == RunStatus.STARTING || runProperty.getStatus() == RunStatus.WAVE_FIGHTING) {
            retryTemplate.execute(context -> {
                waveRunner.handlePhaseInWave(runProperty);
                return null;
            });
        }

        if (runProperty.getStatus() == RunStatus.LOST) {
            log.info("Run ended: Lost battle in Wave: " + runProperty.getWaveIndex());
            return;
        }
        else if(runProperty.getStatus() == RunStatus.ERROR) {
            log.warn("Run ended: Error in Wave: " + runProperty.getWaveIndex());
            phaseProcessor.takeTempScreenshot("error");
            return;
        }

        throw new IllegalStateException("Run ended with unknown status: " + runProperty.getStatus());
    }
}

