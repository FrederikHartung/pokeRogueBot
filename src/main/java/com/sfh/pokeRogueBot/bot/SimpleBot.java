package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.ScreenshotClient;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final RunPropertyService runPropertyService;
    private final JsService jsService;
    private final PhaseProcessor phaseProcessor;
    private final PhaseProvider phaseProvider;
    private final TempFileManager tempFileManager;
    private final BrowserClient browserClient;

    private final String targetUrl;
    private final boolean startRun;

    public SimpleBot(
            RunPropertyService runPropertyService,
            JsService jsService,
            PhaseProcessor phaseProcessor,
            PhaseProvider phaseProvider,
            TempFileManager tempFileManager,
            BrowserClient browserClient,
            @Value("${browser.target-url}") String targetUrl,
            @Value(("${stage.mainmenu.startRun}")) boolean startRun
    ) {
        this.runPropertyService = runPropertyService;
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.phaseProvider = phaseProvider;
        this.tempFileManager = tempFileManager;
        this.browserClient = browserClient;
        this.targetUrl = targetUrl;
        this.startRun = startRun;
    }

    @Override
    public void start() {
        tempFileManager.deleteTempData();
        browserClient.navigateTo(targetUrl);

        RunProperty runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.WAVE_FIGHTING);
        runPropertyService.save(runProperty);

        RetryTemplate retryTemplate = new RetryTemplateBuilder() //todo: add configurable retry policy
                .retryOn(UnsupportedPhaseException.class)
                .maxAttempts(5)
                .fixedBackoff(1000)
                .build();

        log.debug("starting wave fighting mode");
        try{
            while (runProperty.getStatus() == RunStatus.WAVE_FIGHTING) {

                retryTemplate.execute(context -> {
                    handleStageInWave();
                    return null;
                });

            }
        }
        catch (Exception e){
            phaseProcessor.takeScreenshot("error_" + e.getClass().getSimpleName());
            runProperty.setStatus(RunStatus.ERROR);
            return;
        }

        runPropertyService.save(runProperty);
        log.info("finished run, status: " + runProperty.getStatus());
    }

    private void handleStageInWave() throws Exception {

        String phaseAsString = jsService.getCurrentPhaseAsString();
        Phase phase = phaseProvider.fromString(phaseAsString);
        GameMode gameMode = jsService.getGameMode();

        if(null != phase && gameMode != GameMode.UNKNOWN){
            log.debug("phase detected: " + phase.getPhaseName() + ", gameMode: " + gameMode);
            phaseProcessor.handlePhase(phase, gameMode);
            return;
        }
        else if(null == phase && gameMode == GameMode.MESSAGE) {
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , but gameMode is MESSAGE");
            phaseProcessor.handlePhase(phaseProvider.fromString(MessagePhase.NAME), gameMode);
            return;
        }
        else{
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , gameMode: " + gameMode);
        }

        throw new UnsupportedPhaseException(phaseAsString, gameMode);
    }
}

