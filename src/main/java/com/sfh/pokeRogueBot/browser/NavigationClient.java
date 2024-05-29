package com.sfh.pokeRogueBot.browser;

import org.openqa.selenium.WebDriver;

public interface NavigationClient {

    void navigateToTarget(String targetUrl, int waitTimeForLoadingMs) throws InterruptedException;
    void clickAndTypeAtCanvas(int x, int y, String text);
}
