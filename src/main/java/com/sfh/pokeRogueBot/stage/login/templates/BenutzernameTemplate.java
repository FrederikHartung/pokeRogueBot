package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class BenutzernameTemplate implements CvTemplate {
    public static final String PATH = "./data/templates/login/login-benutzername.png";
    private static final String NAME = BenutzernameTemplate.class.getSimpleName();

    public String getTemplatePath() {
        return PATH;
    }

    public String getFilenamePrefix() {
        return NAME;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}
