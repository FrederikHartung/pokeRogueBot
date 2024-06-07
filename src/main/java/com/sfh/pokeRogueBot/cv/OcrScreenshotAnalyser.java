package com.sfh.pokeRogueBot.cv;

import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.ITesseract;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;

@Component
@Slf4j
public class OcrScreenshotAnalyser {

    private final ITesseract instance;

    public OcrScreenshotAnalyser(ITesseract instance,
                                 @Value("${ocr.language}") String language,
                                 @Value("${ocr.datapath}") String datapath) {
        this.instance = instance;

        instance.setDatapath(datapath);
        instance.setLanguage(language);
    }

    public String doOcr(BufferedImage image) {

        try {
            return instance.doOCR(image);
        } catch (Exception e) {
            log.error("Error while doing OCR: " + e.getMessage(), e);
        }

        return null;
    }
}
