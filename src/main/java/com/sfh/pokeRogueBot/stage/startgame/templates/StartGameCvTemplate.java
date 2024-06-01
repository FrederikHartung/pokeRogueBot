package com.sfh.pokeRogueBot.stage.startgame.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class StartGameCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/startgame/startgame-cvtemplate.png";
    private static final String NAME = StartGameCvTemplate.class.getSimpleName();

    @Override
    public int getParentWidth() {
        return 1474;
    }

    @Override
    public int getParentHeight() {
        return 829;
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
