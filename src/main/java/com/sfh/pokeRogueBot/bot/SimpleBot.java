package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.JsConfig;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.service.Brain;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The com.sfh.pokeRogueBot.main bot class that controls the flow of the bot.
 * On start, the Temp folder is cleared and the bot navigates to the target URL.
 * After navigating to the target url, the bot continues with a save game or starts a new run.
 * If a run is lost, the bot reloads the page and starts a new run.
 * If an error occurs, the bot logs the error, saves the game and ends the run. After that, the bot starts a new run on a new save slot.
 * The bot enters a loop and starts new runs till the app is closed or all save game slots are full.
 * The bot can be configured to run a specific number of runs before stopping or endless with maxRunsTillShutdown = -1.
 */

@Slf4j
@Service
public class SimpleBot implements Bot {

    private final JsConfig jsConfig;
    private final FileManager fileManager;
    private final BrowserClient browserClient;
    private final Brain brain;
    private final WaveRunner waveRunner;

    private final String targetUrl;
    private final int maxRunsTillShutdown;

    private int runNumber = 1;

    public SimpleBot(
            JsConfig jsConfig,
            FileManager fileManager,
            BrowserClient browserClient,
            Brain brain,
            WaveRunner waveRunner,
            @Value("${browser.target-url}") String targetUrl,
            @Value("${bot.maxRunsTillShutdown}") int maxRunsTillShutdown
    ) {
        this.jsConfig = jsConfig;
        this.fileManager = fileManager;
        this.browserClient = browserClient;
        this.brain = brain;
        this.waveRunner = waveRunner;

        this.targetUrl = targetUrl;
        this.maxRunsTillShutdown = maxRunsTillShutdown;
    }

    @Override
    public void start() {
        log.info("Starting SimpleBot");
        fileManager.deleteTempData();
        log.debug("Deleting temp data");
        brain.rememberLongTermMemories();
        log.debug("Remember long term memories");
        browserClient.navigateTo(targetUrl);
        log.debug("Navigated to Browsergame");

        while (runNumber <= maxRunsTillShutdown || maxRunsTillShutdown == -1) {
            try {
                startRun();
                log.debug("run finished, starting new run");
                runNumber++;
            } catch (IllegalStateException e) {
                log.error(e.getMessage());
                return;
            }
        }

        log.debug("maxRunsTillShutdown reached, shutting down");
    }

    private void startRun() throws IllegalStateException {

        brain.clearShortTermMemory();
        jsConfig.init();

        RunProperty runProperty = brain.getRunProperty();
        log.debug("run " + runProperty.getRunNumber() + ", starting wave fighting mode");
        while (runProperty.getStatus() == RunStatus.OK) {
            waveRunner.handlePhaseInWave(runProperty);
        }

        if (runProperty.getStatus() == RunStatus.LOST) {
            log.info("Metric: Run {}, save game index: {} ended: Lost battle in Wave: {}", runProperty.getRunNumber(), runProperty.getSaveSlotIndex(), runProperty.getWaveIndex());
            return;
        } else if (runProperty.getStatus() == RunStatus.ERROR) {
            log.warn("Metric: Run {}, save game index: {} ended: Error in Wave: {}", runProperty.getRunNumber(), runProperty.getSaveSlotIndex(), runProperty.getWaveIndex());
            return;
        } else if (runProperty.getStatus() == RunStatus.RELOAD_APP) {
            log.warn("Metric: Run {}, save game index: {} ended: Error in Wave: {}. Reloading app", runProperty.getRunNumber(), runProperty.getSaveSlotIndex(), runProperty.getWaveIndex());
            browserClient.navigateTo(targetUrl);
            return;
        } else if (runProperty.getStatus() == RunStatus.EXIT_APP) {
            log.warn("Metric: Run {}, save game index: {} ended: No available save slot, stopping bot.", runProperty.getRunNumber(), runProperty.getSaveSlotIndex());
            exitApp();
        }

        throw new IllegalStateException("Run ended with unknown status: " + runProperty.getStatus());
    }

    public void exitApp() {
        System.exit(0);
    }
}

