package com.sfh.pokeRogueBot.browser;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.BrowserExeption;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.*;
import org.openqa.selenium.Point;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.time.Duration;
import java.time.temporal.ChronoUnit;

@Component
@Slf4j
public class BrowserClient implements DisposableBean, ScreenshotClient, NavigationClient {

    private static final String CANVAS = "canvas";
    private WebDriver driver;
    private final boolean closeOnExit;

    public BrowserClient(@Value("${browser.closeOnExit:false}") boolean closeOnExit) {
        this.closeOnExit = closeOnExit;
    }


    private WebDriver getWebDriver() {
        ChromeOptions options = new ChromeOptions();

        // Pfad zum Benutzerdatenverzeichnis festlegen
        options.addArguments("user-data-dir=./bin/webdriver/profile/");
        return new ChromeDriver(options);
    }

    @Override
    public void takeScreenshot(String path) {
        try {
            if(null == this.driver){
                throw new BrowserExeption("No webdriver available");
            }

            // Finde das Canvas-Element auf der Webseite
            WebElement canvasElement = driver.findElement(By.tagName(CANVAS));

            // Mache einen Screenshot nur vom Canvas-Element
            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            FileUtils.copyFile(scrFile, new File(path));

            log.debug("Screenshot of canvas saved to " + path);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas", e);
        }
    }

    @Override
    public void navigateAndLogin(String targetUrl, int waitTimeForLoadingMs, UserData userData) throws InterruptedException {
        if(null == this.driver){
            this.driver = getWebDriver();
        }

        driver.get(targetUrl);

        WebDriverWait wait = new WebDriverWait(driver, Duration.of(waitTimeForLoadingMs, ChronoUnit.MILLIS));

        // Warten, bis das erste Text-Eingabefeld sichtbar ist
        WebElement usernameField = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//input[@type='text' and @maxlength='16']")));

        // Warten, bis das erste Passwort-Eingabefeld sichtbar ist
        WebElement passwordField = wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//input[@type='password' and @maxlength='64']")));

        // Benutzerdaten in die Eingabefelder einfügen
        usernameField.sendKeys(userData.getUsername());
        passwordField.sendKeys(userData.getPassword());

        Thread.sleep(500);
        log.debug("filled login form");
    }

    @Override
    public void makeScreenshotAndMarkClickPoint(int x, int y, String path) {
        try {
            // Finde das Canvas-Element auf der Webseite
            WebElement canvasElement = driver.findElement(By.tagName(CANVAS));

            // Mache einen Screenshot nur vom Canvas-Element
            File scrFile = canvasElement.getScreenshotAs(OutputType.FILE);
            BufferedImage img = ImageIO.read(scrFile);

            // Grafikobjekt erstellen, um darauf zu zeichnen
            Graphics2D g2d = img.createGraphics();
            g2d.setColor(Color.RED);  // Setze die Farbe auf Rot
            g2d.fillOval(x - 5, y - 5, 10, 10);  // Zeichne einen Kreis um den Klickpunkt

            // Ressourcen freigeben
            g2d.dispose();

            // Speichere das veränderte Bild
            File outputfile = new File(path);
            ImageIO.write(img, "png", outputfile);

            log.debug("Screenshot of canvas with marked click point saved to " + path);
        } catch (Exception e) {
            log.error("Error while taking screenshot of canvas and marking click point", e);
        }
    }

    @Override
    public void clickAndTypeAtCanvas(int x, int y, String text) {
        try {
            // Lokalisieren des Input-Feldes
            WebElement inputElement = driver.findElement(By.cssSelector("input[type='text'][maxlength='16']"));

            // Sicherstellen, dass das Element sichtbar und interaktionsfähig ist
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.visibilityOf(inputElement));
            new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.elementToBeClickable(inputElement));

            // Klicken auf das Element, um es zu fokussieren
            inputElement.click();

            // Vorherigen Inhalt löschen (falls vorhanden)
            inputElement.clear();

            // Eingabe des Benutzernamens
            inputElement.sendKeys(text);

            log.debug("Username entered successfully.");
            Thread.sleep(500);
        } catch (Exception e) {
            log.error("Error while entering username: " + e.getMessage(), e);
        }
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
}
