package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import lombok.extern.slf4j.Slf4j;
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
import java.nio.file.Path;

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

            if (null != pathChromeUserDir && (!(pathChromeUserDir.isEmpty()))) {
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
            log.error("Error while waiting, error: " + e.getMessage());
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
            log.error("Error while closing browser: " + e.getMessage());
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
    public void addScriptToWindow(Path jsFilePath) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            String jsCode = new String(Files.readAllBytes(jsFilePath));
            js.executeScript(jsCode);
        } catch (NoSuchWindowException e) {
            log.error("Browser window not found.");
            throw e;
        } catch (UnreachableBrowserException e) {
            log.error("Browser unreachable.");
            throw e;
        } catch (Exception e) {
            log.error("Error while adding script to window: " + jsFilePath + ", error: " + e.getMessage());
        }
    }

    @Override
    public Object executeCommandAndGetResult(String jsCommand) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            return js.executeScript(jsCommand);
        } catch (NoSuchWindowException e) {
            log.error("browser window not found, error: " + e.getMessage());
            throw e;
        } catch (UnreachableBrowserException e) {
            log.error("browser unreachable, error: " + e.getMessage());
            throw e;
        } catch (JavascriptException e) {
            String message = e.getMessage();
            // Extract just the core error message without full stack trace
            if (message != null && message.contains("javascript error: ")) {
                String coreError = message.substring(message.indexOf("javascript error: ") + 18);
                if (coreError.contains("\n")) {
                    coreError = coreError.substring(0, coreError.indexOf("\n"));
                }
                log.error("JavaScript error: {} (command: {})", coreError, jsCommand);
            } else {
                log.error("JavaScript Exception: {} (command: {})", message, jsCommand);
            }
            throw e;
        } catch (Exception e) {
            log.error("Error while executing JS command: " + jsCommand + ", error: " + e.getMessage());
            return null;
        }
    }

    @Override
    public void pressKey(KeyToPress keyToPress) {
        Actions actions = new Actions(driver);
        switch (keyToPress) {
            case SPACE:
                WebElement canvasElement = getCanvas();
                actions.moveToElement(canvasElement)
                        .sendKeys(Keys.SPACE)
                        .perform();
                break;
            case ARROW_DOWN:
                actions.sendKeys(Keys.ARROW_DOWN)
                        .perform();
                break;
            case ARROW_LEFT:
                actions.sendKeys(Keys.ARROW_LEFT)
                        .perform();
                break;
            case ARROW_UP:
                actions.sendKeys(Keys.ARROW_UP)
                        .perform();
                break;
            case ARROW_RIGHT:
                actions.sendKeys(Keys.ARROW_RIGHT)
                        .perform();
                break;
            case BACK_SPACE:
                actions.sendKeys(Keys.BACK_SPACE)
                        .perform();
                break;
            case ESCAPE:
                actions.sendKeys(Keys.ESCAPE)
                        .perform();
                break;

            default:
                log.error("Unknown key to press: " + keyToPress);
                throw new NotSupportedException("Unknown key to press in browser: " + keyToPress);
        }
    }

    @Override
    public boolean enterUserData(String userName, String password) {
        String userNameXpath = "//*[@id=\"app\"]/div/input[1]";
        String passwordXpath = "//*[@id=\"app\"]/div/input[2]";

        try {
            WebElement userNameElement = getElementByXpath(userNameXpath);
            userNameElement.sendKeys(userName);
            WebElement passwordElement = getElementByXpath(passwordXpath);
            passwordElement.sendKeys(password);
            return true;
        } catch (NoSuchElementException e) {
            log.error("Error while entering user data: " + e.getMessage());
            return false;
        }
    }
}
