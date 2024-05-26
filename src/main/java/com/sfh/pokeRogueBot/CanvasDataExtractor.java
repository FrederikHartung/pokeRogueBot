package com.sfh.pokeRogueBot;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import net.sourceforge.tess4j.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;

public class CanvasDataExtractor {
    public static void load() throws Exception {
        // Pfad zu Ihrem Chromedriver
        System.setProperty("webdriver.chrome.driver", "/pfad/zum/chromedriver");

        WebDriver driver = new ChromeDriver();
        driver.get("URL_ZUR_WEBAPP");

        // Warten, bis das Canvas-Element geladen ist
        new WebDriverWait(driver, 10).until(
                ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")));

        // Canvas-Element holen
        WebElement canvas = driver.findElement(By.tagName("canvas"));

        // JavaScript ausführen, um das Bild des Canvas zu erhalten
        String canvasUrl = (String) ((JavascriptExecutor) driver).executeScript(
                "return arguments[0].toDataURL('image/png').substring(22);", canvas);

        // Base64-String in Bild umwandeln und speichern
        byte[] imageBytes = Base64.getDecoder().decode(canvasUrl);
        Path path = Paths.get("/pfad/zum/speicherort/canvas.png");
        Files.write(path, imageBytes);

        // Bild mit Tesseract OCR analysieren
        File imageFile = new File("/pfad/zum/speicherort/canvas.png");
        ITesseract instance = new Tesseract();
        try {
            String result = instance.doOCR(imageFile);
            System.out.println("Extrahierte Daten: " + result);
        } catch (TesseractException e) {
            System.err.println(e.getMessage());
        }

        driver.quit();
    }
}

