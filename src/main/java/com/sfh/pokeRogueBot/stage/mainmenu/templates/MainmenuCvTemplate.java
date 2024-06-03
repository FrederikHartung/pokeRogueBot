package com.sfh.pokeRogueBot.stage.mainmenu.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class MainmenuCvTemplate implements CvTemplate {

    public static final String PATH = "./data/templates/mainmenu/mainmenu-cvtemplate.png";
    private static final String NAME = MainmenuCvTemplate.class.getSimpleName();

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
