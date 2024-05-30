package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.template.TemplateManager;
import com.sfh.pokeRogueBot.stage.login.LoginHandler;
import org.springframework.stereotype.Component;

@Component
public class StandardConfig implements Config {

    private final LoginHandler loginHandler;
    private final TempFileManager tempFileManager;
    private final TemplateManager templateManager;

    public StandardConfig(LoginHandler loginHandler, TempFileManager tempFileManager, TemplateManager templateManager) {
        this.loginHandler = loginHandler;
        this.tempFileManager = tempFileManager;
        this.templateManager = templateManager;
    }

    @Override
    public void applay() throws Exception {
        templateManager.checkIfAllTemplatesArePresent();
        tempFileManager.deleteTempData();
        loginHandler.login();
    }
}
