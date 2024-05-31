package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.cv.OpenCvClient;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
public class ChromeBrowserClient implements DisposableBean, BrowserClient {


    private final boolean closeOnExit;
    private final int waitTimeForRenderAfterNavigation;
    private final String pathChromeUserDir;

    /**
     * The instance of the WebDriver is created when first time calling navigateTo()
     */
    private WebDriver driver;


    public ChromeBrowserClient(OpenCvClient openCvClient,
                               @Value("${browser.closeOnExit:false}") boolean closeOnExit,
                               @Value("${browser.waitTimeForRenderAfterNavigation:5000}") int waitTimeForRenderAfterNavigation,
                               @Value("${browser.pathChromeUserDir}") String pathChromeUserDir) {
        this.closeOnExit = closeOnExit;
        this.waitTimeForRenderAfterNavigation = waitTimeForRenderAfterNavigation;
        this.pathChromeUserDir = pathChromeUserDir;
    }

    @Override
    public void navigateTo(String targetUrl) {
        if(null == this.driver){
            ChromeOptions options = new ChromeOptions();

            options.addArguments("user-data-dir=" + pathChromeUserDir);
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
}
