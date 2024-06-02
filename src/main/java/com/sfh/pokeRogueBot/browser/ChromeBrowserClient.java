package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.cv.ScaleFactor;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.util.ScalingUtils;
import com.sfh.pokeRogueBot.model.cv.Point;
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
public class ChromeBrowserClient implements DisposableBean, BrowserClient, ImageClient {

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
                               @Value("${browser.useInkognito:false}") boolean useInkognito) {
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
            if(useInkognito){
                log.info("waiting for asset download in inkognito mode...");
                Thread.sleep(waitTimeForRenderAfterNavigation * 4); // longer wait time for inkognito mode because assets have to be loaded
            }
            else {
                Thread.sleep(waitTimeForRenderAfterNavigation);
            }
        } catch (InterruptedException e) {
            log.error("Error while waiting", e);
        }
    }

    private WebElement getCanvas(){
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
    public boolean waitUntilElementIsVisible(String xpath, int maxWaitTimeInSeconds, String fileNamePrefix) {
        try{
            WebDriverWait wait = new WebDriverWait(driver, Duration.of(maxWaitTimeInSeconds, ChronoUnit.MILLIS));
            wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath(xpath)));
            return true;
        }
        catch (TimeoutException e){
            log.error("Element not visible after " + maxWaitTimeInSeconds + " seconds: " + fileNamePrefix);
            return false;
        }
        catch (Exception e){
            log.error("Error while waiting for element to be visible: " + fileNamePrefix, e);
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
    public void clickOnPoint(Point clickPoint) throws IOException {
        WebElement canvasElement = getCanvas();
        Actions actions = new Actions(driver);

        // scroll to the canvas element
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView(true);", canvasElement);

        // wait till the canvas element is clickable
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        wait.until(ExpectedConditions.elementToBeClickable(canvasElement));

        Rectangle canvasRect = canvasElement.getRect();
        int canvasWidth = canvasRect.getWidth();
        int canvasHeight = canvasRect.getHeight();
        int canvasX = canvasRect.getX();
        int canvasY = canvasRect.getY();

        // calc the scaled position to click
        ScaleFactor scaleFactor = ScalingUtils.calcScaleFactor(new Size(canvasWidth, canvasHeight));
        int scaledClickPositionX = canvasX + (int)Math.round(clickPoint.getX() * scaleFactor.getScaleFactorWidth());
        int scaledClickPositiony = canvasY + (int)Math.round(clickPoint.getY() * scaleFactor.getScaleFactorHeight());

        String messageSize = "canvas width: " + canvasWidth + ", hight: " + canvasHeight + ", normed width: " + Constants.STANDARDISED_CANVAS_WIDTH + ", hight: " + Constants.STANDARDISED_CANVAS_HEIGHT;
        log.debug(messageSize);

        String messageX = "normed click x: " + clickPoint.getX() + ", scalefactor x: " + scaleFactor.getScaleFactorWidth() + " , calculated click x: " + scaledClickPositionX;
        log.debug(messageX);

        String messageY = "normed click y: " + clickPoint.getY() + ", scalefactor y: " + scaleFactor.getScaleFactorHeight() + " , calculated click y: " + scaledClickPositiony;
        log.debug(messageY);

        try {
            actions.moveByOffset(scaledClickPositionX, scaledClickPositiony)
                    .click()
                    .perform();
            log.debug("Clicked on point: " + scaledClickPositionX + ", " + scaledClickPositiony);
        } catch (MoveTargetOutOfBoundsException e) {
            log.error("Target out of bounds. Canvas size: width=" + canvasWidth + ", height=" + canvasHeight + ". Click position: x=" + scaledClickPositionX + ", y=" + scaledClickPositiony, e);
            throw e;
        }
    }

    @Override
    public void pressKey(KeyToPress keyToPress) {
        Actions actions = new Actions(driver);
        switch (keyToPress){
            case SPACE:
                log.debug("Pressing SPACE");
                WebElement canvasElement = getCanvas();
                actions.moveToElement(canvasElement)
                        .sendKeys(Keys.SPACE)
                        .perform();
                break;
            case ARROW_DOWN:
                log.debug("Pressing ARROW_DOWN");
                actions.sendKeys(Keys.ARROW_DOWN)
                        .perform();
                break;
            case DELETE:
                log.debug("Pressing DELETE");
                actions.sendKeys(Keys.DELETE)
                        .perform();
                break;

            default:
                log.error("Unknown key to press: " + keyToPress);
                throw new NotSupportedException("Unknown key to press in browser: " + keyToPress);
        }
    }
}
