package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.NoUiPhase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.WaitingService;
import com.sfh.pokeRogueBot.service.javascript.JsUiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LoginPhase extends AbstractPhase implements NoUiPhase {

    public static final String NAME = "LoginPhase";

    private final BrowserClient browserClient;
    private final WaitingService waitingService;
    private final JsUiService jsUIService;
    private final String userName;
    private final String password;

    public LoginPhase(
            BrowserClient browserClient, WaitingService waitingService, JsUiService jsUIService,
            @Value("${browser.userName}") String userName,
            @Value("${browser.password}") String password
    ) {
        this.browserClient = browserClient;
        this.waitingService = waitingService;
        this.jsUIService = jsUIService;
        this.userName = userName;
        this.password = password;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForUiMode(UiMode uiMode) throws NotSupportedException {
        if (uiMode == UiMode.LOADING) {
            return new PhaseAction[]{
                    this.waitLonger
            };
        } else if (uiMode == UiMode.LOGIN_FORM) {
            waitingService.waitLonger();
            boolean enterUserDataSuccess = browserClient.enterUserData(userName, password);
            if (enterUserDataSuccess) {
                log.debug("entered user data successfully");
                boolean userDataSubmitted = jsUIService.submitUserData();
                if (userDataSubmitted) {
                    log.debug("submitted user data successfully");
                    return new PhaseAction[]{
                            this.waitBriefly
                    };
                } else {
                    log.error("could not submit user data");
                }
            } else {
                log.error("could not enter user data");
            }
        } else if (uiMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("UiMode " + uiMode + "not supported in " + NAME);
    }
}
