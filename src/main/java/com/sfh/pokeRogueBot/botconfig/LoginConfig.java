package com.sfh.pokeRogueBot.botconfig;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.stage.login.LoginHandler;
import org.springframework.stereotype.Component;

@Component
public class LoginConfig implements Config {

    private final LoginHandler loginHandler;
    private final TempFileManager tempFileManager;
    private final TemplatePathValidator templatePathValidator;
    private final BrowserClient browserClient;

    public LoginConfig(LoginHandler loginHandler, TempFileManager tempFileManager, TemplatePathValidator templatePathValidator, BrowserClient browserClient) {
        this.loginHandler = loginHandler;
        this.tempFileManager = tempFileManager;
        this.templatePathValidator = templatePathValidator;
        this.browserClient = browserClient;
    }

    @Override
    public void applay() throws Exception {
        templatePathValidator.checkIfAllTemplatesArePresent();
        tempFileManager.deleteTempData();
        browserClient.navigateTo(Constants.TARGET_URL);
        loginHandler.login();
    }
}
