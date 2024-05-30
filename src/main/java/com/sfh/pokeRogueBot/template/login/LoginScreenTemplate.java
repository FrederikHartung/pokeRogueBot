package com.sfh.pokeRogueBot.template.login;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplateAction;

public class LoginScreenTemplate implements Template {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final String XPATH = "//*[@id=\"app\"]/div";

    public static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate();
    public static final BenutzernameInputTemplate BENUTZERNAME_INPUT = new BenutzernameInputTemplate();
    public static final PasswortInputTemplate PASSWORT_INPUT = new PasswortInputTemplate();


    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return LoginScreenTemplate.class.getSimpleName();
    }

    @Override
    public String getXpath() {
        return XPATH;
    }

    @Override
    public Template[] getSubTemplates() {
        return new Template[]{BENUTZERNAME_INPUT, PASSWORT_INPUT, ANMELDEN_BUTTON};
    }

    @Override
    public TemplateIdentificationType getIdentificationType() {
        return TemplateIdentificationType.X_PATH;
    }

    @Override
    public TemplateActionType[] getTemplateActionTypesToPerform() {
        return new TemplateActionType[TemplateActionType.HANDLE_SUB_TEMPLATES.ordinal()];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        TemplateAction benutzernameAction = new TemplateAction(TemplateActionType.ENTER_TEXT, BENUTZERNAME_INPUT);
        TemplateAction passwortAction = new TemplateAction(TemplateActionType.ENTER_TEXT, PASSWORT_INPUT);
        TemplateAction waitAction = new TemplateAction(TemplateActionType.WAIT, null);
        TemplateAction screenshotAction = new TemplateAction(TemplateActionType.TAKE_SCREENSHOT, this);
        return new TemplateAction[]{benutzernameAction, passwortAction, waitAction, screenshotAction};
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}