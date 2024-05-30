package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.UserData;

public interface NavigationClient {

    void navigateAndLogin(String targetUrl, int waitTimeForLoadingMs, UserData userData) throws InterruptedException;
    void clickAndTypeAtCanvas(int x, int y, String text);
}
