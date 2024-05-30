package com.sfh.pokeRogueBot.stage.login.templates;

import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
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

    @Override
    public String getXpath() throws NotSupportedException {
        throw new NotSupportedException("AnmeldenButtonTemplate does not support getXpath()");
    }

    @Override
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.IMAGE;
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }
}
