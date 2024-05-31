package com.sfh.pokeRogueBot.stage.newgame.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class IntroScreenTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/newgame/introScreenTemplate.png";

    @Override
    public int getParentWidth() {
        return 1500;
    }

    @Override
    public int getParentHeight() {
        return 844;
    }

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return IntroScreenTemplate.class.getSimpleName();
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }
}
