package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class RegistrierenButtonTemplate implements CvTemplate {
    public static final String PATH = "./data/templates/login/login-registrieren-button.png";
    private static final String NAME = RegistrierenButtonTemplate.class.getSimpleName();

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
