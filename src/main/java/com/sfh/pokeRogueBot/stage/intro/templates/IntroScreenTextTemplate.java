package com.sfh.pokeRogueBot.stage.intro.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class IntroScreenTextTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/intro/intro-text.png";
    private static final String NAME = IntroScreenTextTemplate.class.getSimpleName();
    private final OcrPosition ocrPosition;
    private final boolean persistSourceImageForDebugging;

    public IntroScreenTextTemplate(OcrPosition ocrPosition, boolean persistSourceImageForDebugging) {
        this.ocrPosition = ocrPosition;
        this.persistSourceImageForDebugging = persistSourceImageForDebugging;
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

    @Override
    public double getConfidenceThreshhold() {
        return 0.7;
    }

    @Override
    public OcrPosition getOcrPosition() {
        return ocrPosition;
    }

    @Override
    public boolean persistSourceImageForDebugging() {
        return persistSourceImageForDebugging;
    }

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
