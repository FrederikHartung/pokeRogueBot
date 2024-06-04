package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.model.exception.StageNotFoundException;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.mainmenu.MainMenuStage;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class StartGameConfig implements Config {

    private final StageProcessor stageProcessor;
    private final LoginScreenStage loginScreenStage;
    private final IntroStage introStage;
    private final MainMenuStage mainMenuStage;

    private final TempFileManager tempFileManager;
    private final TemplatePathValidator templatePathValidator;
    private final BrowserClient browserClient;


    public StartGameConfig(StageProcessor stageProcessor,
                           LoginScreenStage loginScreenStage,
                           IntroStage introStage,
                           MainMenuStage mainMenuStage,
                           TempFileManager tempFileManager,
                           TemplatePathValidator templatePathValidator,
                           BrowserClient browserClient) {
        this.stageProcessor = stageProcessor;
        this.mainMenuStage = mainMenuStage;
        this.loginScreenStage = loginScreenStage;
        this.introStage = introStage;
        this.tempFileManager = tempFileManager;
        this.templatePathValidator = templatePathValidator;
        this.browserClient = browserClient;
    }

    @Override
    public void applay() throws Exception {

        templatePathValidator.checkIfAllTemplatesArePresent();
        tempFileManager.deleteTempData();
        browserClient.navigateTo(Constants.TARGET_URL);

        boolean isLoginFormVisible = stageProcessor.isStageVisible(loginScreenStage);
        if(isLoginFormVisible){
            log.info("LoginScreenStage found");
            stageProcessor.handleStage(loginScreenStage);
            log.info("handled LoginScreenStage");
        }
        else{
            log.debug("No LoginScreenStage found");
        }

        boolean isNewGameStageVisible = stageProcessor.isStageVisible(introStage);
        if(isNewGameStageVisible){
            log.info("IntroStage found");
            stageProcessor.handleStage(introStage);
            log.info("handled IntroStage");
        }
        else if(isLoginFormVisible){
            //maybe this case is wrong to throw an exception, if a user already played a game and then just logoff
            throw new StageNotFoundException("no intro stage found after login form");
        }
        else{
            log.debug("No IntroStage found");
        }

        boolean isMainMenuStageVisible = stageProcessor.isStageVisible(mainMenuStage);
        if(isMainMenuStageVisible){
            log.info("MainMenuStage found");
            stageProcessor.handleStage(mainMenuStage);
            log.info("handled MainMenuStage");
        }
        else{
            throw new StageNotFoundException("MainMenuStage not found"); //main menu stage is mandatory
        }
    }
}
