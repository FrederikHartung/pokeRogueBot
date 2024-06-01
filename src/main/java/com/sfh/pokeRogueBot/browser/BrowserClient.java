package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebElement;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface BrowserClient {

    void navigateTo(String targetUrl);

    WebElement getElementByXpath(String xpath);

    String getBodyAsText();

    boolean waitUntilElementIsVisible(String xpath, int maxWaitTimeInSeconds, String fileNamePrefix);

    void sendKeysToElement(String xpath, String text) throws NoSuchElementException;

    void clickOnElement(String xpath);

    void clickOnPoint(int middlePointX, int middlePointY);

    void pressKey(KeyToPress keyToPress);
}
