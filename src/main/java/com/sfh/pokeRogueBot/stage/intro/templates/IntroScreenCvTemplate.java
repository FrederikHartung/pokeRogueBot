package com.sfh.pokeRogueBot.stage.intro.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class IntroScreenCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/intro/introScreenCvTemplate.png";

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return IntroScreenCvTemplate.class.getSimpleName();
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }
}
