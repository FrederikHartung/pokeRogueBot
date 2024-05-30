package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.browser.NavigationClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.LoginException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class LoginHandler {

    private final NavigationClient navigationClient;

    public LoginHandler(NavigationClient navigationClient) {
        this.navigationClient = navigationClient;
    }

    public boolean login() throws Exception {
        UserData userData = UserDataProvider.getUserdata(Constants.PATH_TO_USER_DATA);
        LoginScreenStage loginScreenStage = new LoginScreenStage(userData);
        boolean isLoginFormVisible = navigateToTargetAndCheckLoginForm(loginScreenStage);
        if(isLoginFormVisible){
            navigationClient.handleStage(loginScreenStage);
            log.debug("handled LoginScreenStage");
        }

        //todo
        return true;
    }

    private boolean navigateToTargetAndCheckLoginForm(LoginScreenStage loginScreenStage) throws LoginException {
        try{
            navigationClient.navigateTo(Constants.TARGET_URL);
            boolean isLoginFormVisible = navigationClient.isStageVisible(loginScreenStage);
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
