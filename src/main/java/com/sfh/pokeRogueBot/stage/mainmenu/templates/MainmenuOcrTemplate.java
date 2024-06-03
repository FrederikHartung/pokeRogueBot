package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.template.OcrTemplate;

public class MainmenuOcrTemplate implements OcrTemplate {

    public static final String PATH = "./data/templates/mainmenu/mainmenu-cvtemplate.png";
    private static final String NAME = MainmenuOcrTemplate.class.getSimpleName();
    private static final OcrPosition OCR_POSITION = new OcrPosition(
            new Point(927, 484),
            new Size(512, 312)
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
        return false;
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
