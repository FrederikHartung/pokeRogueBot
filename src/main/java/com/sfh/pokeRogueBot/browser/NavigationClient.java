package com.sfh.pokeRogueBot.browser;

public interface NavigationClient {

    void navigateToTarget(String targetUrl, int waitTimeForLoadingMs) throws InterruptedException;
}
