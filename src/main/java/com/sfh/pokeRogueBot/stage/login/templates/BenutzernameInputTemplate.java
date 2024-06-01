package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.template.HtmlTemplate;

public class BenutzernameInputTemplate implements HtmlTemplate {

    public static final String PATH = "./data/templates/login/login-eingabemaske.png";
    public static final String NAME = BenutzernameInputTemplate.class.getSimpleName();
    public static final String XPATH = "//*[@id=\"app\"]/div/input[1]";

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }

    @Override
    public String getXpath() {
        return XPATH;
    }
}
