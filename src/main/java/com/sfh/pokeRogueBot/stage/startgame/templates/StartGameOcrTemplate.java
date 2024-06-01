package com.sfh.pokeRogueBot.stage.startgame.templates;

import com.sfh.pokeRogueBot.template.OcrTemplate;

public class StartGameOcrTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/startgame/startgame-cvtemplate.png";
    private static final String NAME = StartGameOcrTemplate.class.getSimpleName();

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

    @Override
    public double getConfidenceThreshhold() {
        return 0.7;
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
