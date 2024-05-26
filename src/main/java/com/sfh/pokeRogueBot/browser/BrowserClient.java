package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.service.ScreenshotService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.time.Duration;
import java.time.temporal.ChronoUnit;

@Component
@Slf4j
public class BrowserClient implements DisposableBean, ScreenshotClient, NavigationClient {

    private static final String CANVAS = "canvas";
    private final WebDriver driver;

    public BrowserClient(WebDriver driver) {
        this.driver = driver;
    }

    @Override
    public void takeScreenshot(String path) {
        try{
            File scrFile = ((TakesScreenshot)driver).getScreenshotAs(OutputType.FILE);
            FileUtils.copyFile(scrFile, new File(path));
            log.debug("Screenshot saved to " + path);
        }
        catch (Exception e){
            log.error("Error while taking screenshots", e);
        }
    }

    @Override
    public void navigateToTarget(String targetUrl, int waitTimeForLoadingMs) throws InterruptedException {
        driver.get(targetUrl);

        new WebDriverWait(driver, Duration.of(waitTimeForLoadingMs, ChronoUnit.MILLIS)).until(
                ExpectedConditions.presenceOfElementLocated(By.tagName(CANVAS)));
        Thread.sleep(waitTimeForLoadingMs);
        log.debug("Navigated to target " + targetUrl);
    }

    @Override
    public void destroy() throws Exception {
        try{
            driver.quit();
            log.debug("Browser closed");
        }
        catch (Exception e){
            log.error("Error while closing browser", e);
        }
    }
}
