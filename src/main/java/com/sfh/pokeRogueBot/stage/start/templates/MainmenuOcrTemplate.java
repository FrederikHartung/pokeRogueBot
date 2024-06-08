package com.sfh.pokeRogueBot.stage.start.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.template.BaseOcrTemplate;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class MainmenuOcrTemplate extends BaseOcrTemplate implements OcrTemplate {

    public MainmenuOcrTemplate(String path, OcrPosition ocrPosition, double confidenceThreshhold, boolean persistSourceImageForDebugging) {
        super(path, ocrPosition, confidenceThreshhold, persistSourceImageForDebugging);
    }

    @Override
    public String[] getExpectedTexts() {
        return new String[]{
                "neues",
                "spiel",
                "laden",
                "täglicher",
                "run",
                "einstellungen"
        };
    }
}
