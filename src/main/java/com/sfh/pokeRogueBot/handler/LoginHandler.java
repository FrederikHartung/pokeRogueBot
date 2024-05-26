package com.sfh.pokeRogueBot.handler;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LoginHandler {

    private final long delayForFirstCheckMs;

    public LoginHandler(@Value("${handler.login.delayForFirstCheckMs}") long delayForFirstCheckMs) {
        this.delayForFirstCheckMs = delayForFirstCheckMs;
    }

    public void login() {

    }

    public static boolean isLoginForm(String message) {
        return message.startsWith("Melde dich an oder erstelle einen Account zum starten");
    }
}
