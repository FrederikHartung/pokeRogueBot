package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.remote.UnreachableBrowserException;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

@Slf4j
@Component
public class ChromeBrowserClient implements DisposableBean, BrowserClient, ImageClient, JsClient {

    private final boolean closeOnExit;
    private final int waitTimeForRenderAfterNavigation;
    private final String pathChromeUserDir;
    private final String chromeProfile;

    /**
     * The instance of the WebDriver is created when first time calling navigateTo()
     */
    private WebDriver driver;


    public ChromeBrowserClient(@Value("${browser.closeOnExit:false}") boolean closeOnExit,
                               @Value("${browser.waitTimeForRenderAfterNavigation:5000}") int waitTimeForRenderAfterNavigation,
                               @Value("${browser.pathChromeUserDir}") String pathChromeUserDir,
                               @Value("${browser.chromeProfile}") String chromeProfile
                               ) {
        this.closeOnExit = closeOnExit;
        this.waitTimeForRenderAfterNavigation = waitTimeForRenderAfterNavigation;
        this.pathChromeUserDir = pathChromeUserDir;
        this.chromeProfile = chromeProfile;
    }

    @Override
    public void navigateTo(String targetUrl) {
        if (null == this.driver) {
            ChromeOptions options = new ChromeOptions();
            if(!StringUtils.isEmpty(pathChromeUserDir)){
                log.debug("Using Chrome user dir: " + pathChromeUserDir + " and profile: " + chromeProfile);
                options.addArguments("user-data-dir=" + pathChromeUserDir);
                options.addArguments("--profile-directory=" + chromeProfile);
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

    private WebElement getCanvas() {
        return driver.findElement(By.tagName("canvas"));
    }

    @Override
    public WebElement getElementByXpath(String xpath) {
        return driver.findElement(By.xpath(xpath));
    }

    @Override
    public void destroy() throws Exception {
        try {
            if (closeOnExit && null != driver) {
                driver.quit();
                log.debug("Browser closed");
            }
        } catch (Exception e) {
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
    public String executeJsAndGetResult(String jsFilePath) {
        try {
            String jsCode = new String(Files.readAllBytes(Paths.get(jsFilePath)));

            JavascriptExecutor js = (JavascriptExecutor) driver;
            Object result = js.executeScript(jsCode);

            if (result instanceof String resultAsString) {
                return resultAsString;
            } else if (result instanceof Long) {
                return String.valueOf(result);
            } else if( null == result){
                throw new NotSupportedException("Result of JS execution is null");
            }
            else {
                throw new NotSupportedException("Result of JS execution is not a string, got type: " + result.getClass().getSimpleName());
            }
        }
        catch (NoSuchWindowException e){
            log.error("browser window not found", e);
            throw e;
        }
        catch (UnreachableBrowserException e){
            log.error("browser unreachable", e);
            throw e;
        }
        catch (Exception e) {
            log.error("Error while executing JS: " + jsFilePath, e);
            return null;
        }
    }

    @Override
    public boolean setModifierOptionsCursor(String jsFilePath, int rowIndex, int columnIndex) {
        try {
            String jsCode = new String(Files.readAllBytes(Paths.get(jsFilePath)));

            JavascriptExecutor js = (JavascriptExecutor) driver;
            Object result = js.executeScript(jsCode, rowIndex, columnIndex);

            if (result instanceof Boolean resultAsBoolean) {
                return resultAsBoolean;
            } else {
                throw new NotSupportedException("Result of JS execution is not a Boolean, got type: " + result.getClass().getSimpleName());
            }
        } catch (Exception e) {
            log.error("Error while executing JS: " + jsFilePath, e);
            return false;
        }
    }

    @Override
    public boolean setPartyCursor(String setPartyCursor, int index) {
        try {
            String jsCode = new String(Files.readAllBytes(Paths.get(setPartyCursor)));

            JavascriptExecutor js = (JavascriptExecutor) driver;
            Object result = js.executeScript(jsCode, index);

            if (result instanceof Boolean resultAsBoolean) {
                return resultAsBoolean;
            } else {
                throw new NotSupportedException("Result of JS execution is not a Boolean, got type: " + result.getClass().getSimpleName());
            }
        } catch (Exception e) {
            log.error("Error while executing JS: " + setPartyCursor, e);
            return false;
        }
    }

    @Override
    public void pressKey(KeyToPress keyToPress) {
        Actions actions = new Actions(driver);
        switch (keyToPress) {
            case SPACE:
                log.debug("Pressing space");
                WebElement canvasElement = getCanvas();
                actions.moveToElement(canvasElement)
                        .sendKeys(Keys.SPACE)
                        .perform();
                break;
            case ARROW_DOWN:
                log.debug("Pressing arrow down");
                actions.sendKeys(Keys.ARROW_DOWN)
                        .perform();
                break;
            case ARROW_LEFT:
                log.debug("Pressing arrow left");
                actions.sendKeys(Keys.ARROW_LEFT)
                        .perform();
                break;
            case ARROW_UP:
                log.debug("Pressing arrow up");
                actions.sendKeys(Keys.ARROW_UP)
                        .perform();
                break;
            case ARROW_RIGHT:
                log.debug("Pressing arrow right");
                actions.sendKeys(Keys.ARROW_RIGHT)
                        .perform();
                break;
            case BACK_SPACE:
                log.debug("Pressing backspace");
                actions.sendKeys(Keys.BACK_SPACE)
                        .perform();
                break;

            default:
                log.error("Unknown key to press: " + keyToPress);
                throw new NotSupportedException("Unknown key to press in browser: " + keyToPress);
        }
    }
}
