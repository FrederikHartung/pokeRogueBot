package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.stage.login.LoginHandler;
import org.springframework.stereotype.Component;

@Component
public class LoginConfig implements Config {

    private final LoginHandler loginHandler;
    private final TempFileManager tempFileManager;
    private final TemplatePathValidator templatePathValidator;

    public LoginConfig(LoginHandler loginHandler, TempFileManager tempFileManager, TemplatePathValidator templatePathValidator) {
        this.loginHandler = loginHandler;
        this.tempFileManager = tempFileManager;
        this.templatePathValidator = templatePathValidator;
    }

    @Override
    public void applay() throws Exception {
        templatePathValidator.checkIfAllTemplatesArePresent();
        tempFileManager.deleteTempData();
        loginHandler.login();
    }
}
