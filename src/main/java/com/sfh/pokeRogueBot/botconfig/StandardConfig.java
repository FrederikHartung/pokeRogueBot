package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.handler.LoginHandler;
import com.sfh.pokeRogueBot.service.ScreenshotService;
import org.springframework.stereotype.Component;

@Component
public class StandardConfig implements Config {

    private final ScreenshotService screenshotService;
    private final LoginHandler loginHandler;

    public StandardConfig(ScreenshotService screenshotService, LoginHandler loginHandler) {
        this.screenshotService = screenshotService;
        this.loginHandler = loginHandler;
    }

    @Override
    public void applay() {
        screenshotService.deleteAllOldScreenshots();
        loginHandler.login();
    }
}
