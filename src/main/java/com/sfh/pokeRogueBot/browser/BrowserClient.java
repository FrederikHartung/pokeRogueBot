package com.sfh.pokeRogueBot.browser;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.openqa.selenium.*;
import org.openqa.selenium.Point;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.DisposableBean;
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
    private final WebDriver driver;

    public BrowserClient(WebDriver driver) {
        this.driver = driver;
    }

    @Override
    public void takeScreenshot(String path) {
        try {
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
    public void navigateToTarget(String targetUrl, int waitTimeForLoadingMs) throws InterruptedException {
        driver.get(targetUrl);

        new WebDriverWait(driver, Duration.of(waitTimeForLoadingMs, ChronoUnit.MILLIS)).until(
                ExpectedConditions.presenceOfElementLocated(By.tagName(CANVAS)));
        Thread.sleep(waitTimeForLoadingMs);
        log.debug("Navigated to target " + targetUrl);
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

    public void focusAndSetInputText(WebDriver driver, WebElement element, String text) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("arguments[0].focus(); arguments[0].value = arguments[1];", element, text);
    }

    public void markClickPosition(WebDriver driver, WebElement canvasElement, int x, int y) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        String script =
                "const ctx = arguments[0].getContext('2d');" +
                        "ctx.fillStyle = 'red';" +
                        "ctx.beginPath();" +
                        "ctx.arc(arguments[1], arguments[2], 10, 0, 2 * Math.PI);" +
                        "ctx.fill();";
        js.executeScript(script, canvasElement, x, y);
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
