package com.sfh.pokeRogueBot.stage.intro.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.ParentSize;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class IntroScreenTextTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/intro/introScreenCvTemplate.png";
    private static final String NAME = IntroScreenTextTemplate.class.getSimpleName();
    private static final OcrPosition OCR_POSITION = new OcrPosition(
            new Point(42, 650),
            new Size(1330, 150),
            new ParentSize(1474, 829)
    );

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
        return OCR_POSITION;
    }

    @Override
    public boolean persistSourceImageForDebugging() {
        return true;
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
