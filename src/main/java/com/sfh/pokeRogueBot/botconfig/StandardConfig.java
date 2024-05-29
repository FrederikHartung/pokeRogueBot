package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.filehandler.TempFileCleaner;
import com.sfh.pokeRogueBot.template.TemplateManager;
import com.sfh.pokeRogueBot.template.login.LoginHandler;
import org.springframework.stereotype.Component;

@Component
public class StandardConfig implements Config {

    private final LoginHandler loginHandler;
    private final TempFileCleaner tempFileCleaner;
    private final TemplateManager templateManager;

    public StandardConfig(LoginHandler loginHandler, TempFileCleaner tempFileCleaner, TemplateManager templateManager) {
        this.loginHandler = loginHandler;
        this.tempFileCleaner = tempFileCleaner;
        this.templateManager = templateManager;
    }

    @Override
    public void applay() throws Exception {
        templateManager.checkIfAllTemplatesArePresent();
        tempFileCleaner.deleteTempData();
        loginHandler.login();
    }
}
