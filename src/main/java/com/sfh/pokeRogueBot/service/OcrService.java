package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.cv.OcrResult;
import com.sfh.pokeRogueBot.template.OcrTemplate;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface OcrService {

    String getOcrString(OcrTemplate ocrTemplate) throws IOException;
    String getOcrString(OcrTemplate ocrTemplate, BufferedImage canvas) throws IOException;

    OcrResult checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate) throws IOException;
    OcrResult checkIfOcrTemplateIsVisible(OcrTemplate ocrTemplate, BufferedImage canvas) throws IOException;
}
