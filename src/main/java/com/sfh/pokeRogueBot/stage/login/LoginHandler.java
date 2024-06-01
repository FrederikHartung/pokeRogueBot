package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.stage.StageProcessor;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class LoginHandler {

    private final StageProcessor stageProcessor;

    public LoginHandler(StageProcessor stageProcessor) {
        this.stageProcessor = stageProcessor;
    }

    public boolean login() throws Exception {
        LoginScreenStage loginScreenStage = new LoginScreenStage();

        boolean isLoginFormVisible = stageProcessor.isStageVisible(loginScreenStage);
        if(isLoginFormVisible){
            log.info("LoginScreenStage found");
            stageProcessor.handleStage(loginScreenStage);
            log.info("handled LoginScreenStage");
        }
        else{
            log.debug("No LoginScreenStage found");
        }

        IntroStage introStage = new IntroStage();
        boolean isNewGameStageVisible = stageProcessor.isStageVisible(introStage);
        if(isNewGameStageVisible){
            log.info("IntroStage found");
            stageProcessor.handleStage(introStage);
            log.info("handled IntroStage");
        }
        else{
            log.debug("No IntroStage found");
        }

        return true;
    }
}
