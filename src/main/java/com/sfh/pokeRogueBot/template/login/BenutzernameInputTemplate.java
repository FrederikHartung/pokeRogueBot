package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplateAction;

import java.util.List;

public class BenutzernameInputTemplate implements Template {

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

    @Override
    public Template[] getSubTemplates() {
        return new Template[0];
    }

    @Override
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.X_PATH;
    }

    @Override
    public TemplateActionType[] getTemplateActionTypesToPerform() {
        return new TemplateActionType[TemplateActionType.ENTER_TEXT.ordinal()];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[]{
                new TemplateAction(TemplateActionType.ENTER_TEXT, this)
        };
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}
