package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.model.OcrResult;
import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.ITesseract;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@Slf4j
public class ScreenshotAnalyser {

    private final ITesseract instance;

    public ScreenshotAnalyser(ITesseract instance,
                              @Value("${ocr.language}") String language,
                              @Value("${ocr.datapath}") String datapath) {
        this.instance = instance;

        instance.setDatapath(datapath);
        instance.setLanguage(language);
    }

    public OcrResult doOcr(String path) {
        File imageFile = new File(path);

        try {
            String extractedText = instance.doOCR(imageFile);

            return new OcrResult(
                    extractedText,
                    path
            );
        } catch (Exception e) {
            log.error("Error while doing OCR: " + e.getMessage(), e);
        }

        return null;
    }
}
