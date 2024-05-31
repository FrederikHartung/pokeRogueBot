package com.sfh.pokeRogueBot.browser;

import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.interactions.MoveTargetOutOfBoundsException;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
public class ChromeBrowserClient implements DisposableBean, BrowserClient {

    private final boolean closeOnExit;
    private final int waitTimeForRenderAfterNavigation;
    private final String pathChromeUserDir;
    private final boolean useInkognito;

    /**
     * The instance of the WebDriver is created when first time calling navigateTo()
     */
    private WebDriver driver;


    public ChromeBrowserClient(@Value("${browser.closeOnExit:false}") boolean closeOnExit,
                               @Value("${browser.waitTimeForRenderAfterNavigation:5000}") int waitTimeForRenderAfterNavigation,
                               @Value("${browser.pathChromeUserDir}") String pathChromeUserDir,
                               @Value("${browser.deleteCookiesOnStart:false}") boolean useInkognito) {
        this.closeOnExit = closeOnExit;
        this.waitTimeForRenderAfterNavigation = waitTimeForRenderAfterNavigation;
        this.pathChromeUserDir = pathChromeUserDir;
        this.useInkognito = useInkognito;
    }

    @Override
    public void navigateTo(String targetUrl) {
        if(null == this.driver){
            ChromeOptions options = new ChromeOptions();

            options.addArguments("user-data-dir=" + pathChromeUserDir);
            if(useInkognito){
                options.addArguments("--incognito");
                log.debug("starting in incognito mode");
            }
            this.driver = new ChromeDriver(options);
        }

        driver.get(targetUrl);

        try {
            Thread.sleep(waitTimeForRenderAfterNavigation);
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    @Override
    public WebElement getCanvas(){
        return driver.findElement(By.tagName("canvas"));
    }

    @Override
    public WebElement getElementByXpath(String xpath){
        return driver.findElement(By.xpath(xpath));
    }

    @Override
    public String getBodyAsText() {
        return driver.findElement(By.tagName("body")).getAttribute("innerHTML");
    }

    @Override
    public void destroy() throws Exception {
        try{
            if(closeOnExit){
                driver.quit();
                log.debug("Browser closed");
            }
        }
        catch (Exception e){
            log.error("Error while closing browser", e);
        }
    }

    @Override
    public BufferedImage takeScreenshotFromCanvas() throws IOException {
        // find the canvas element
        WebElement canvasElement = getCanvas();

        // make screenshot of the canvas element
        byte[] screenshotBytes = canvasElement.getScreenshotAs(OutputType.BYTES);

        // convert the byte array to a BufferedImage
        try (ByteArrayInputStream bais = new ByteArrayInputStream(screenshotBytes)) {
            return ImageIO.read(bais);
        }
    }

    @Override
    public boolean waitUntilElementIsVisible(String xpath, int maxWaitTimeInSeconds) {
        try{
            WebDriverWait wait = new WebDriverWait(driver, Duration.of(maxWaitTimeInSeconds, ChronoUnit.SECONDS));
            wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath(xpath)));
            return true;
        }
        catch (Exception e){
            log.error("Error while waiting for element to be visible", e);
            return false;
        }
    }

    @Override
    public void sendKeysToElement(String xpath, String text) throws NoSuchElementException {
        WebElement element = getElementByXpath(xpath);
        element.sendKeys(text);
    }

    @Override
    public void clickOnElement(String xpath) {
        WebElement element = getElementByXpath(xpath);
        element.click();
    }

    @Override
    public void clickOnPoint(int middlePointX, int middlePointY) {
        WebElement canvasElement = getCanvas();
        Actions actions = new Actions(driver);

        // Scrollen Sie zum Canvas-Element, um sicherzustellen, dass es im Viewport sichtbar ist
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView(true);", canvasElement);

        // Warten Sie, bis das Canvas-Element sichtbar und klickbar ist
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        wait.until(ExpectedConditions.elementToBeClickable(canvasElement));

        // Holen Sie sich die Größe und Position des Canvas-Elements
        Rectangle canvasRect = canvasElement.getRect();
        int canvasWidth = canvasRect.getWidth();
        int canvasHeight = canvasRect.getHeight();
        int canvasX = canvasRect.getX();
        int canvasY = canvasRect.getY();

        log.debug("Canvas position and size: x=" + canvasX + ", y=" + canvasY + ", width=" + canvasWidth + ", height=" + canvasHeight);

        // Berechnen Sie die absolute Position zum Klicken
        int clickX = canvasX + middlePointX;
        int clickY = canvasY + middlePointY;

        log.debug("Attempting to click at absolute position: " + clickX + ", " + clickY);

        try {
            actions.moveByOffset(clickX, clickY)
                    .click()
                    .perform();
            log.debug("Clicked on point: " + middlePointX + ", " + middlePointY);
        } catch (MoveTargetOutOfBoundsException e) {
            log.error("Target out of bounds. Canvas size: width=" + canvasWidth + ", height=" + canvasHeight + ". Click position: x=" + clickX + ", y=" + clickY, e);
            throw e;
        }
    }
}
