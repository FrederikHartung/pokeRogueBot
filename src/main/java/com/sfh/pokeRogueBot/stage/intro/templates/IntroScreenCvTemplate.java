package com.sfh.pokeRogueBot.stage.intro.templates;

import com.sfh.pokeRogueBot.model.cv.ParentSize;
import com.sfh.pokeRogueBot.template.CvTemplate;

public class IntroScreenCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/intro/introScreenCvTemplate.png";
    private static final ParentSize PARENT_SIZE = new ParentSize(1502, 845);

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return IntroScreenCvTemplate.class.getSimpleName();
    }

    @Override
    public ParentSize getParentSize() {
        return PARENT_SIZE;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }
}
