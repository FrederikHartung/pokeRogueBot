package com.sfh.pokeRogueBot.stage.start.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.template.BaseOcrTemplate;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class IntroScreenTextTemplate extends BaseOcrTemplate implements OcrTemplate {

    public IntroScreenTextTemplate(String path, OcrPosition ocrPosition, double confidenceThreshhold, boolean persistSourceImageForDebugging) {
        super(path, ocrPosition, confidenceThreshhold, persistSourceImageForDebugging);
    }

    @Override
    public String[] getExpectedTexts() {
        return new String[]{
                "willkommen",
                "bei",
                "poke",
                "rogue",
                "dies",
                "ist",
                "ein",
                "kampf",
                "orientiertes",
                "pokemon",
                "fangame",
                "mit",
                "roguelite",
                "elementen"
        };
    }
}
