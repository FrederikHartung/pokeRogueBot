package com.sfh.pokeRogueBot.stage.startgame.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class StartGameCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/startgame/startgame-cvtemplate.png";
    private static final String NAME = StartGameCvTemplate.class.getSimpleName();

    @Override
    public boolean persistResultWhenFindingTemplate() {
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
