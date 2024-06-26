package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import org.openqa.selenium.WebElement;

public interface BrowserClient {

    void navigateTo(String targetUrl);

    WebElement getElementByXpath(String xpath);

    void pressKey(KeyToPress keyToPress);

    boolean enterUserData(String userName, String password);
}
