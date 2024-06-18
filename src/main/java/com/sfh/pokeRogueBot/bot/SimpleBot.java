package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.file.FileManager;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.enums.RunStatus;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.phase.impl.MessagePhase;
import com.sfh.pokeRogueBot.phase.impl.TitlePhase;
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
    private final FileManager fileManager;
    private final BrowserClient browserClient;

    private final String targetUrl;
    private final boolean startRun;

    RunProperty runProperty;

    public SimpleBot(
            RunPropertyService runPropertyService,
            JsService jsService,
            PhaseProcessor phaseProcessor,
            PhaseProvider phaseProvider,
            FileManager fileManager,
            BrowserClient browserClient,
            @Value("${browser.target-url}") String targetUrl,
            @Value(("${stage.mainmenu.startRun}")) boolean startRun
    ) {
        this.runPropertyService = runPropertyService;
        this.jsService = jsService;
        this.phaseProcessor = phaseProcessor;
        this.phaseProvider = phaseProvider;
        this.fileManager = fileManager;
        this.browserClient = browserClient;
        this.targetUrl = targetUrl;
        this.startRun = startRun;
    }

    @Override
    public void start() {
        fileManager.deleteTempData();
        browserClient.navigateTo(targetUrl);
        jsService.init();

        while (startRun()){
            log.debug("run finished, starting new run");
        }
    }

    private boolean startRun(){
        runProperty = runPropertyService.getRunProperty();
        runProperty.setStatus(RunStatus.STARTING);
        runPropertyService.save(runProperty);

        RetryTemplate retryTemplate = new RetryTemplateBuilder() //todo: add configurable retry policy
                .retryOn(UnsupportedPhaseException.class)
                .maxAttempts(5)
                .fixedBackoff(1000)
                .build();

        log.debug("run " + runProperty.getRunNumber() + ", starting wave fighting mode");
        try {
            while (runProperty.getStatus() == RunStatus.STARTING || runProperty.getStatus() == RunStatus.WAVE_FIGHTING) {

                retryTemplate.execute(context -> {
                    handleStageInWave();
                    if(runProperty.getStatus() == RunStatus.LOST){

                    }
                    return null;
                });

            }
        } catch (Exception e) {
            log.error("error while running", e);
            phaseProcessor.takeScreenshot("error_" + e.getClass().getSimpleName());
            runProperty.setStatus(RunStatus.ERROR);
            return false;
        }

        runPropertyService.save(runProperty);
        log.info("finished run, status: " + runProperty.getStatus());
        return true;
    }

    private void handleStageInWave() throws Exception {

        String phaseAsString = jsService.getCurrentPhaseAsString();
        Phase phase = phaseProvider.fromString(phaseAsString);
        GameMode gameMode = jsService.getGameMode();

        if (null != phase && gameMode != GameMode.UNKNOWN) {
            log.debug("phase detected: " + phase.getPhaseName() + ", gameMode: " + gameMode);
            phaseProcessor.handlePhase(phase, gameMode);
        } else if (null == phase && gameMode == GameMode.MESSAGE) {
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , but gameMode is MESSAGE");
            phaseProcessor.handlePhase(phaseProvider.fromString(MessagePhase.NAME), gameMode);
        } else {
            log.debug("no known phase detected, phaseAsString: " + phaseAsString + " , gameMode: " + gameMode);
            throw new UnsupportedPhaseException(phaseAsString, gameMode);
        }

        if(null != phase && phase.getPhaseName().equals(TitlePhase.NAME)){
            if(runProperty.getStatus() == RunStatus.STARTING){
                runProperty.setStatus(RunStatus.WAVE_FIGHTING);
                runPropertyService.save(runProperty);
            }
            else if(runProperty.getStatus() == RunStatus.WAVE_FIGHTING){
                runProperty.setStatus(RunStatus.LOST);
                runPropertyService.save(runProperty);
                browserClient.navigateTo(targetUrl); //reload the page
            }
        }
    }
}

