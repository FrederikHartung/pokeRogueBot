package com.sfh.pokeRogueBot.browser;

import org.openqa.selenium.WebElement;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface BrowserClient {

    void navigateTo(String targetUrl);
    WebElement getCanvas();

    WebElement getElementByXpath(String xpath);

    String getBodyAsText();

    BufferedImage takeScreenshotFromCanvas() throws IOException;

    boolean waitUntilElementIsVisible(String xpath, int maxWaitTimeInSeconds);
}
