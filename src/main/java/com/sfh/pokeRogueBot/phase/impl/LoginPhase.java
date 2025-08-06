package com.sfh.pokeRogueBot.phase.impl;

import com.sfh.pokeRogueBot.browser.BrowserClient;
import com.sfh.pokeRogueBot.model.enums.UiMode;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.phase.AbstractPhase;
import com.sfh.pokeRogueBot.phase.Phase;
import com.sfh.pokeRogueBot.phase.actions.PhaseAction;
import com.sfh.pokeRogueBot.service.JsService;
import com.sfh.pokeRogueBot.service.WaitingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class LoginPhase extends AbstractPhase implements Phase {

    public static final String NAME = "LoginPhase";

    private final BrowserClient browserClient;
    private final WaitingService waitingService;
    private final JsService jsService;
    private final String userName;
    private final String password;

    public LoginPhase(
            BrowserClient browserClient, WaitingService waitingService, JsService jsService, @Value("${browser.userName}") String userName,
            @Value("${browser.password}") String password
    ) {
        this.browserClient = browserClient;
        this.waitingService = waitingService;
        this.jsService = jsService;
        this.userName = userName;
        this.password = password;
    }

    @Override
    public String getPhaseName() {
        return NAME;
    }

    @Override
    public PhaseAction[] getActionsForGameMode(UiMode gameMode) throws NotSupportedException {
        if (gameMode == UiMode.LOADING) {
            return new PhaseAction[]{
                    this.waitLonger
            };
        } else if (gameMode == UiMode.LOGIN_FORM) {
            waitingService.waitLonger();
            boolean enterUserDataSuccess = browserClient.enterUserData(userName, password);
            if (enterUserDataSuccess) {
                log.debug("entered user data successfully");
                boolean userDataSubmitted = jsService.submitUserData();
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
        } else if (gameMode == UiMode.MESSAGE) {
            return new PhaseAction[]{
                    this.pressSpace
            };
        }

        throw new NotSupportedException("Gamemode " + gameMode + "not supported in " + NAME);
    }
}
