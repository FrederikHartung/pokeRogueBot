package com.sfh.pokeRogueBot.stage.startgame.templates;

import com.sfh.pokeRogueBot.model.cv.ParentSize;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class StartGameCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/startgame/startgame-cvtemplate.png";
    private static final String NAME = StartGameCvTemplate.class.getSimpleName();
    private static final ParentSize PARENT_SIZE = new ParentSize(1474, 829);

    @Override
    public ParentSize getParentSize() {
        return PARENT_SIZE;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
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
