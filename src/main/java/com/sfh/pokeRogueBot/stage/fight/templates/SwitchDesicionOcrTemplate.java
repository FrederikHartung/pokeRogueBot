package com.sfh.pokeRogueBot.stage.fight.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.template.BaseOcrTemplate;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class SwitchDesicionOcrTemplate extends BaseOcrTemplate implements OcrTemplate {

    public SwitchDesicionOcrTemplate(String path, OcrPosition ocrPosition, double confidenceThreshhold, boolean persistSourceImageForDebugging) {
        super(path, ocrPosition, confidenceThreshhold, persistSourceImageForDebugging);
    }

    @Override
    public String[] getExpectedTexts() {
        return new String[]{
                "möchtest",
                "du",
                "pokemon",
                "auswechseln?"
        };
    }
}
