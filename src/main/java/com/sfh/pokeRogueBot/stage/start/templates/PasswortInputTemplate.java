package com.sfh.pokeRogueBot.stage.start.templates;

import com.sfh.pokeRogueBot.template.HtmlTemplate;

public class PasswortInputTemplate implements HtmlTemplate {

    public static final String PATH = "./data/templates/login/login-eingabemaske.png";
    public static final String NAME = PasswortInputTemplate.class.getSimpleName();
    public static final String XPATH = "//*[@id=\"app\"]/div/input[2]";

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

    @Override
    public boolean persistOnHtmlElementNotFound() {
        return false;
    }
}
