package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.LoginException;
import com.sfh.pokeRogueBot.stage.StageProcessor;
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
        boolean isLoginFormVisible = navigateToTargetAndCheckLoginForm(loginScreenStage);
        if(isLoginFormVisible){
            stageProcessor.handleStage(loginScreenStage);
            log.debug("handled LoginScreenStage");
        }

        //todo
        return true;
    }

    private boolean navigateToTargetAndCheckLoginForm(LoginScreenStage loginScreenStage) throws LoginException {
        try{
            browserClient.navigateTo(Constants.TARGET_URL);
            boolean isLoginFormVisible = stageProcessor.isStageVisible(loginScreenStage);
            if(isLoginFormVisible){
                log.debug("Login form found");
                return true;
            }
            else{
                log.debug("No login form found");
                return false;
            }
        }
        catch (Exception e){
            throw new LoginException(e.getMessage(), e);
        }
    }
}
