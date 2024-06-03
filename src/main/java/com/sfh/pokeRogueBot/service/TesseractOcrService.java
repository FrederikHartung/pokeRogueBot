package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.cv.OcrScreenshotAnalyser;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.OcrResult;
import com.sfh.pokeRogueBot.template.OcrTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;

@Slf4j
@Component
public class TesseractOcrService implements OcrService {

    private final ImageService imageService;
    private final OcrScreenshotAnalyser ocrScreenshotAnalyser;

    public TesseractOcrService(ImageService imageService, OcrScreenshotAnalyser ocrScreenshotAnalyser) {
        this.imageService = imageService;
        this.ocrScreenshotAnalyser = ocrScreenshotAnalyser;
    }

    public String getOcrString(OcrTemplate ocrTemplate) throws IOException {
        BufferedImage canvas = imageService.takeScreenshot(ocrTemplate.getFilenamePrefix() + "_ocrSource");
        BufferedImage ocrImage = imageService.getSubImage(
                canvas,
                ocrTemplate.getOcrPosition().getTopLeft(),
                ocrTemplate.getOcrPosition().getSize());

        if(ocrTemplate.persistSourceImageForDebugging()){
            ScreenshotFilehandler.persistBufferedImage(ocrImage, ocrTemplate.getFilenamePrefix() + "_ocrSource");
        }

        return ocrScreenshotAnalyser.doOcr(ocrImage).getFoundText().toLowerCase();
    }

    public OcrResult checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate) throws IOException {
        String ocrResult = getOcrString(ocrTemplate);
        int foundStrings = 0;
        int totalStrings = ocrTemplate.getExpectedTexts().length;
        for (String expectedText : ocrTemplate.getExpectedTexts()) {
            if(ocrResult.contains(expectedText)){
                foundStrings++;
            }
        }

        return new OcrResult(ocrResult, (double)foundStrings / totalStrings);
    }
}
