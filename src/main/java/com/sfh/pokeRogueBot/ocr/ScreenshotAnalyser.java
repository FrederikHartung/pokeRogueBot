package com.sfh.pokeRogueBot.ocr;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
public class ScreenshotAnalyser {
    public static void analyseFile(String path) throws TesseractException {
        File imageFile = new File(path);
        ITesseract instance = new Tesseract();
        instance.setLanguage("deu");
        instance.setDatapath("/opt/homebrew/Cellar/tesseract/5.3.4_1/share/tessdata");
        try {
            String result = instance.doOCR(imageFile);
            System.out.println("Bild: " + path + ", Extrahierte Daten: " + result);
        } catch (TesseractException e) {
            System.err.println(e.getMessage());
            throw e;
        }
    }
}
