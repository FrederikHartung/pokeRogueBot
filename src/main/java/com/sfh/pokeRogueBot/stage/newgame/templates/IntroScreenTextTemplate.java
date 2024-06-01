package com.sfh.pokeRogueBot.stage.newgame.templates;

import com.sfh.pokeRogueBot.template.OcrTemplate;

public class IntroScreenTextTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/newgame/introScreenCvTemplate.png";
    private static final String NAME = IntroScreenTextTemplate.class.getSimpleName();

    @Override
    public String[] getOcrTexts() {
        return new String[]{
                "Willkommen",
                "bei",
                "PokeRogue",
                "Dies",
                "ist",
                "ein",
                "kampforiejtiertes",
                "Pokemon-Fangame",
                "mit",
                "Roguelite-Elementen",
        };
    }

    @Override
    public double getMinConfidence() {
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
