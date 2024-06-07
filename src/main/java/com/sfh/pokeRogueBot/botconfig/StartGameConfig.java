package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.StageIdentifier;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.StageProvider;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final StageIdentifier stageIdentifier;
    private final StageProvider stageProvider;

    private final TempFileManager tempFileManager;
    private final TemplatePathValidator templatePathValidator;
    private final BrowserClient browserClient;


    public StartGameConfig(StageProcessor stageProcessor,
                           StageIdentifier stageIdentifier,
                           StageProvider stageProvider,
                           TempFileManager tempFileManager,
                           TemplatePathValidator templatePathValidator,
                           BrowserClient browserClient) {
        this.stageProcessor = stageProcessor;
        this.stageIdentifier = stageIdentifier;
        this.stageProvider = stageProvider;
        this.tempFileManager = tempFileManager;
        this.templatePathValidator = templatePathValidator;
        this.browserClient = browserClient;
    }

    @Override
    public void applay() throws Exception {

        templatePathValidator.checkIfAllTemplatesArePresent();
        tempFileManager.deleteTempData();
        browserClient.navigateTo(Constants.TARGET_URL);

        boolean ifFirstStageIsVisible = stageIdentifier.checkIfFirstStageIsVisible(
                stageProvider.getLoginScreenStage(),
                stageProvider.getIntroStage(),
                stageProvider.getMainMenuStage()
        );

        RetryTemplate retryTemplate = new RetryTemplateBuilder()
                .retryOn(StageNotFoundException.class)
                .retryOn(TemplateNotFoundException.class)
                .fixedBackoff(5000)
                .maxAttempts(2)
                .build();

        retryTemplate.execute(context -> {
            if(ifFirstStageIsVisible) {
                boolean isLoginVisible = stageIdentifier.isStageVisible(stageProvider.getLoginScreenStage());
                if(isLoginVisible){
                    log.debug("stage identified: loginScreenStage");
                    stageProcessor.handleStage(stageProvider.getLoginScreenStage());
                }

                boolean isIntroVisible = stageIdentifier.isStageVisible(stageProvider.getIntroStage());
                if(isIntroVisible){
                    log.debug("stage identified: introStage");
                    stageProcessor.handleStage(stageProvider.getIntroStage());
                }

                boolean isMainMenuVisible = stageIdentifier.isStageVisible(stageProvider.getMainMenuStage());
                if(isMainMenuVisible){
                    log.debug("stage identified: mainMenuStage");
                    stageProcessor.handleStage(stageProvider.getMainMenuStage());
                }
                else{
                    stageProcessor.takeScreensot("no_main_menu_stage_visible");
                    throw new StageNotFoundException("No main menu stage is visible");
                }
            }

            return null;
        });

    }
}
