package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.model.exception.NotSupportedException;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplateAction;

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
    public Template[] getSubTemplates() {
        return new Template[0];
    }

    @Override
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.IMAGE;
    }

    @Override
    public TemplateActionType[] getTemplateActionTypesToPerform() {
        return new TemplateActionType[TemplateActionType.CLICK.ordinal()];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        TemplateAction clickAction = new TemplateAction(TemplateActionType.CLICK, this);
        return new TemplateAction[]{clickAction};
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return true;
    }
}
