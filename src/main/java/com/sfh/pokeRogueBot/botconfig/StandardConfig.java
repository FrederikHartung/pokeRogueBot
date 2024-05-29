package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.filehandler.TempFileCleaner;
import com.sfh.pokeRogueBot.handler.LoginHandler;
import org.springframework.stereotype.Component;

@Component
public class StandardConfig implements Config {

    private final LoginHandler loginHandler;
    private final TempFileCleaner tempFileCleaner;

    public StandardConfig(LoginHandler loginHandler, TempFileCleaner tempFileCleaner) {
        this.loginHandler = loginHandler;
        this.tempFileCleaner = tempFileCleaner;
    }

    @Override
    public void applay() throws Exception {
        tempFileCleaner.deleteTempData();
        loginHandler.login();
    }
}
