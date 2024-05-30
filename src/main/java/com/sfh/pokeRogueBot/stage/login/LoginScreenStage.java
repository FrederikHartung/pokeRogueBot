package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplateAction;
import com.sfh.pokeRogueBot.stage.login.templates.AnmeldenButtonTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.BenutzernameInputTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.PasswortInputTemplate;

public class LoginScreenStage implements Template, Stage {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final String XPATH = "//*[@id=\"app\"]/div";

    public static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate();
    public static final BenutzernameInputTemplate BENUTZERNAME_INPUT = new BenutzernameInputTemplate();
    public static final PasswortInputTemplate PASSWORT_INPUT = new PasswortInputTemplate();

    private final UserData userData;

    public LoginScreenStage(UserData userData) {
        this.userData = userData;
    }


    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return LoginScreenStage.class.getSimpleName();
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