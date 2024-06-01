package com.sfh.pokeRogueBot.stage.newgame.templates;

import com.sfh.pokeRogueBot.template.OcrTemplate;

public class IntroScreenTextTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/newgame/introScreenCvTemplate.png";
    private static final String NAME = IntroScreenTextTemplate.class.getSimpleName();

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
        return 0.8;
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
