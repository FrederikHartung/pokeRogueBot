package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.template.Template;

public class PasswortInputTemplate implements Template {

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
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.X_PATH;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}
