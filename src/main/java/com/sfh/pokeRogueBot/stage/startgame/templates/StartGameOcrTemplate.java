package com.sfh.pokeRogueBot.stage.startgame.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.ParentSize;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class StartGameOcrTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/startgame/startgame-cvtemplate.png";
    private static final String NAME = StartGameOcrTemplate.class.getSimpleName();
    private static final OcrPosition OCR_POSITION = new OcrPosition(
            new Point(927, 484),
            new Size(512, 312),
            new ParentSize(1474, 829)
    );

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
