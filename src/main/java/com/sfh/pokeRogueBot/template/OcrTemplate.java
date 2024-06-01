package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;

public interface OcrTemplate extends Template{
    String[] getExpectedTexts();
    double getConfidenceThreshhold();
    OcrPosition getOcrPosition();

    boolean persistSourceImageForDebugging();
}
