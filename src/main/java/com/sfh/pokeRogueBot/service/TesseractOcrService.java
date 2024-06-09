package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.cv.OcrScreenshotAnalyser;
import com.sfh.pokeRogueBot.filehandler.ScreenshotFilehandler;
import com.sfh.pokeRogueBot.model.cv.OcrResult;
import com.sfh.pokeRogueBot.template.OcrTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.io.IOException;

@Slf4j
@Service
public class TesseractOcrService implements OcrService {

    public static final String OCR_SOURCE = "_ocrSource";
    private final ImageService imageService;
    private final OcrScreenshotAnalyser ocrScreenshotAnalyser;

    public TesseractOcrService(ImageService imageService, OcrScreenshotAnalyser ocrScreenshotAnalyser) {
        this.imageService = imageService;
        this.ocrScreenshotAnalyser = ocrScreenshotAnalyser;
    }

    @Override
    public String getOcrString(OcrTemplate ocrTemplate) throws IOException {
        BufferedImage canvas = imageService.takeScreenshot(ocrTemplate.getFilenamePrefix() + OCR_SOURCE);
        BufferedImage ocrImage = imageService.getSubImage(
                canvas,
                ocrTemplate.getOcrPosition().getTopLeft(),
                ocrTemplate.getOcrPosition().getSize());

        if(ocrTemplate.persistSourceImageForDebugging()){
            ScreenshotFilehandler.persistBufferedImage(ocrImage, ocrTemplate.getFilenamePrefix() + OCR_SOURCE);
        }

        return ocrScreenshotAnalyser.doOcr(ocrImage).toLowerCase();
    }

    @Override
    public String getOcrString(OcrTemplate ocrTemplate, BufferedImage canvas) throws IOException {
        BufferedImage ocrImage = imageService.getSubImage(
                canvas,
                ocrTemplate.getOcrPosition().getTopLeft(),
                ocrTemplate.getOcrPosition().getSize());

        if(ocrTemplate.persistSourceImageForDebugging()){
            ScreenshotFilehandler.persistBufferedImage(ocrImage, ocrTemplate.getFilenamePrefix() + OCR_SOURCE);
        }

        return ocrScreenshotAnalyser.doOcr(ocrImage).toLowerCase();
    }

    @Override
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

    @Override
    public OcrResult checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate, BufferedImage canvas) throws IOException {
        String ocrResult = getOcrString(ocrTemplate, canvas);
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
