package com.sfh.pokeRogueBot.browser;

import org.openqa.selenium.WebElement;

public interface BrowserClient {

    void navigateTo(String targetUrl);

    WebElement getElementByXpath(String xpath);

    boolean enterUserData(String userName, String password);
}
