package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.template.Template;

public class AnmeldenButtonTemplate implements Template {

    public static final String PATH = "./data/templates/login/login-anmelden-button.png";
    public static final String NAME = AnmeldenButtonTemplate.class.getSimpleName();

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
