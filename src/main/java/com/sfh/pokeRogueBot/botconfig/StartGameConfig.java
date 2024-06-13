package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.model.browser.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.StageProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import static com.sfh.pokeRogueBot.phase.Phase.LOGIN_PHASE;
import static com.sfh.pokeRogueBot.phase.Phase.TITLE_PHASE;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final StageProvider stageProvider;

    private final TempFileManager tempFileManager;
    private final BrowserClient browserClient;
    private final JsService jsService;


    public StartGameConfig(StageProcessor stageProcessor,
                           StageProvider stageProvider,
                           TempFileManager tempFileManager,
                           BrowserClient browserClient, JsService jsService) {
        this.stageProcessor = stageProcessor;
        this.stageProvider = stageProvider;
        this.tempFileManager = tempFileManager;
        this.browserClient = browserClient;
        this.jsService = jsService;
    }

    @Override
    public void applay() throws Exception {

        tempFileManager.deleteTempData();
        browserClient.navigateTo(Constants.TARGET_URL);

        RetryTemplate retryTemplate = new RetryTemplateBuilder()
                .retryOn(StageNotFoundException.class)
                .fixedBackoff(2000)
                .maxAttempts(120)
                .build();

        retryTemplate.execute(context -> {
            String currentPhase = jsService.getCurrentPhaseAsString();

                if(StringUtils.hasText(currentPhase)){
                    GameMode mode = jsService.getGameMode();
                    log.debug("checking if loginScreenStage is visible, current phase: {}, mode: {}", currentPhase, mode);
                    if(currentPhase.equals(LOGIN_PHASE) && mode == GameMode.LOGIN_FORM){
                        log.debug("stage identified: loginScreenStage");
                        stageProcessor.handleStage(stageProvider.getLoginScreenStage());
                    }

                    currentPhase = jsService.getCurrentPhaseAsString();
                    mode = jsService.getGameMode();
                    log.debug("checking if introStage is visible, current phase: {}, mode: {}", currentPhase, mode);
                    if(currentPhase.equals(LOGIN_PHASE) && mode == GameMode.MESSAGE){
                        log.debug("stage identified: introStage");
                        stageProcessor.handleStage(stageProvider.getIntroStage());
                    }

                    currentPhase = jsService.getCurrentPhaseAsString();
                    mode = jsService.getGameMode();
                    log.debug("checking if titleStage is visible, current phase: {}, mode: {}", currentPhase, mode);
                    if(currentPhase.equals(TITLE_PHASE)){
                        log.debug("stage identified: mainMenuStage");
                        stageProcessor.handleStage(stageProvider.getMainMenuStage());
                        return null;
                    }
                    else{
                        stageProcessor.takeScreensot("no_main_menu_stage_visible");
                        throw new StageNotFoundException("No main menu stage is visible");
                    }
                }

            throw new StageNotFoundException("No Stage found");
        });

    }
}
