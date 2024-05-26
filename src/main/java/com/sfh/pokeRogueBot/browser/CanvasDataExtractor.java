package com.sfh.pokeRogueBot.browser;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import net.sourceforge.tess4j.*;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.temporal.ChronoUnit;

@Component
@Slf4j
public class CanvasDataExtractor implements DisposableBean {

    private final WebDriver driver;

    public CanvasDataExtractor(WebDriver driver) {
        this.driver = driver;
    }

    public String makeScreenshot(String filename) {
        try{
            deleteAllOldScreenshots();
            driver.get("https://pokerogue.net/");

            // Warten, bis das Canvas-Element geladen ist
            new WebDriverWait(driver, Duration.of(10, ChronoUnit.SECONDS)).until(
                    ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")));

            //take a screenshot every 5 seconds till 12 screenshots are taken
            for(int i = 0; i < 12; i++){
                takeAndSaveScreenshot(driver, i);
                Thread.sleep(5000);
            }
        }
        catch (Exception e){
            e.printStackTrace();
        }
    }

    private static void takeAndSaveScreenshot(WebDriver driver, int number) throws IOException, TesseractException {
        File scrFile = ((TakesScreenshot)driver).getScreenshotAs(OutputType.FILE);
        FileUtils.copyFile(scrFile, new File("./bin/screenshots/fullpage_" + number + ".png"));

        analyseFile("./bin/screenshots/fullpage_" + number + ".png");
    }




    @Override
    public void destroy() throws Exception {
        this.driver.quit();
    }
}

