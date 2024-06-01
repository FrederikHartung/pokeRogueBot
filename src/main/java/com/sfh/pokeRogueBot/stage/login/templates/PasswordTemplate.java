package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.template.CvTemplate;

public class PasswordTemplate implements CvTemplate {
    public static final String PATH = "./data/templates/login/login-password.png";
    private static final String NAME = PasswordTemplate.class.getSimpleName();

    public String getTemplatePath() {
        return PATH;
    }

    public String getFilenamePrefix() {
        return NAME;
    }

    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}
