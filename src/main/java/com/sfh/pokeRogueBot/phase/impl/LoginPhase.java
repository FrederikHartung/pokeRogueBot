package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.model.enums.GameMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.JsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.print.attribute.standard.MediaSize;

@Slf4j
@Component
public class LoginPhase extends AbstractPhase implements Phase {

    private static final String NAME = "LoginPhase";

    private final BrowserClient browserClient;
    private final JsService jsService;
    private final String userName;
    private final String password;

    public LoginPhase(
            BrowserClient browserClient, JsService jsService, @Value("${browser.userName}") String userName,
            @Value("${browser.password}") String password
    ) {
        this.browserClient = browserClient;
        this.jsService = jsService;
        this.userName = userName;
        this.password = password;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(GameMode gameMode) throws NotSupportedException {
        if(gameMode == GameMode.LOADING){
            return new PhaseAction[]{
                    this.waitForTextRenderAction
            };
        }
        else if(gameMode == GameMode.LOGIN_FORM){
            boolean enterUserDataSuccess = browserClient.enterUserData(userName, password);
            if(enterUserDataSuccess){
                log.debug("entered user data successfully");
                boolean userDataSubmitted = jsService.submitUserData();
                if (userDataSubmitted) {
                    log.debug("submitted user data successfully");
                    return new PhaseAction[]{
                            this.waitAction
                    };
                }
                else {
                    log.error("could not submit user data");
                }
            }
            else {
                log.error("could not enter user data");
            }
        }

        throw new NotSupportedException("Gamemode " + gameMode + "not supported in " + NAME);
    }
}
