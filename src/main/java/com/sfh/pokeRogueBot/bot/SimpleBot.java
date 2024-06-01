package com.sfh.pokeRogueBot.bot;

import com.sfh.pokeRogueBot.botconfig.LoginConfig;
import com.sfh.pokeRogueBot.botconfig.StartGameConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SimpleBot implements Bot {

    private final LoginConfig loginConfig;
    private final StartGameConfig startGameConfig;

    public SimpleBot(LoginConfig loginConfig, StartGameConfig startGameConfig) {
        this.loginConfig = loginConfig;
        this.startGameConfig = startGameConfig;
    }

    @Override
    public void start() {
        try {
            loginConfig.applay();
            startGameConfig.applay();
        }
        catch (Exception e){
            log.error("Error while starting simple bot", e);
        }
    }
}

