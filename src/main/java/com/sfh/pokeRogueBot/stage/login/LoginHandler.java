package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.LoginException;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.newgame.NewGameStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class LoginHandler {

    private final StageProcessor stageProcessor;
    private final BrowserClient browserClient;

    public LoginHandler(StageProcessor stageProcessor, BrowserClient browserClient) {
        this.stageProcessor = stageProcessor;
        this.browserClient = browserClient;
    }

    public boolean login() throws Exception {
        UserData userData = UserDataProvider.getUserdata(Constants.PATH_TO_USER_DATA);
        LoginScreenStage loginScreenStage = new LoginScreenStage(userData);
        browserClient.navigateTo(Constants.TARGET_URL);

        boolean isLoginFormVisible = stageProcessor.isStageVisible(loginScreenStage);
        if(isLoginFormVisible){
            log.info("Login form found");
            stageProcessor.handleStage(loginScreenStage);
            log.info("handled LoginScreenStage");
        }
        else{
            log.debug("No login form found");
        }

        boolean isNewGameStageVisible = stageProcessor.isStageVisible(new NewGameStage());
        if(isNewGameStageVisible){
            log.info("New game stage found");
            stageProcessor.handleStage(new NewGameStage());
            log.info("handled NewGameStage");
        }
        else{
            log.debug("No new game stage found");
        }

        //todo
        return true;
    }
}
