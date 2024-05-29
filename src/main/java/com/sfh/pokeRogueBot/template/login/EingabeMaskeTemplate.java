package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.template.Template;

public class EingabeMaskeTemplate implements Template {

    public static final String PATH = "./data/templates/login/login-eingabemaske.png";
    public static final String NAME = EingabeMaskeTemplate.class.getSimpleName();

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
