package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.model.RunProperty;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.model.exception.UnsupportedPhaseException;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.PhaseProcessor;
import com.sfh.pokeRogueBot.phase.PhaseProvider;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.StageProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final PhaseProvider phaseProvider;
    private final PhaseProcessor phaseProcessor;

    private final TempFileManager tempFileManager;
    private final BrowserClient browserClient;
    private final JsService jsService;
    private final WaitingService waitingService;

    private final String targetUrl;
    private final boolean useLocalHost;
    private final String localHostUrl;


    public StartGameConfig(PhaseProvider phaseProvider,
                           PhaseProcessor phaseProcessor,
                           TempFileManager tempFileManager,
                           BrowserClient browserClient,
                           JsService jsService,
                           WaitingService waitingService,
                           @Value("${browser.target-url}") String targetUrl,
                           @Value("${browser.use-local-host}") boolean useLocalHost,
                           @Value("${browser.local-host-url}") String localHostUrl) {
        this.phaseProvider = phaseProvider;
        this.phaseProcessor = phaseProcessor;
        this.tempFileManager = tempFileManager;
        this.browserClient = browserClient;
        this.jsService = jsService;
        this.waitingService = waitingService;
        this.targetUrl = targetUrl;
        this.useLocalHost = useLocalHost;
        this.localHostUrl = localHostUrl;
    }

    @Override
    public void applay() throws Exception {

        tempFileManager.deleteTempData();

        if(!useLocalHost) {
            browserClient.navigateTo(targetUrl);
        }
        else {
            browserClient.navigateTo(localHostUrl);
        }

        RetryTemplate retryTemplate = new RetryTemplateBuilder()
                .retryOn(StageNotFoundException.class)
                .fixedBackoff(2000)
                .maxAttempts(120)
                .build();

        retryTemplate.execute(context -> {

            while(true){
                String phaseAsString = jsService.getCurrentPhaseAsString();
                Phase phase = phaseProvider.fromString(phaseAsString);
                GameMode gameMode = jsService.getGameMode();

                log.debug("phaseAsString: " + phaseAsString + ", gameMode: " + gameMode);
                handePhaseIfPresent(phase, gameMode);
                waitingService.waitEvenLongerForRender();
            }

        });

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
