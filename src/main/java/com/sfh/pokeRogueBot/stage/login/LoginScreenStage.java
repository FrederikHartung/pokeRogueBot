package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.login.templates.*;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputAction;

public class LoginScreenStage implements HtmlTemplate, Stage {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final String XPATH = "//*[@id=\"app\"]/div";

    private static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate(false);
    private static final BenutzernameInputTemplate BENUTZERNAME_INPUT = new BenutzernameInputTemplate();
    private static final PasswortInputTemplate PASSWORT_INPUT = new PasswortInputTemplate();

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

    /**
     * return the templates that are used to validate that the stage
     */
    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                ANMELDEN_BUTTON,
                BENUTZERNAME_INPUT,
                PASSWORT_INPUT,
                new SimpleCvTemplate(
                        "login-benutzername",
                        "./data/templates/login/login-benutzername.png",
                        false),
                new SimpleCvTemplate(
                        "login-passwort",
                        "./data/templates/login/login-passwort.png",
                        false),
                new SimpleCvTemplate("login-registrieren",
                        "./data/templates/login/login-registrieren-button.png",
                        false),
        };
    }

    public UserData getUserData() {
        return UserDataProvider.getUserdata(Constants.PATH_TO_USER_DATA);
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        UserData userData = getUserData();

        TextInputAction benutzernameAction = new TextInputAction(BENUTZERNAME_INPUT, userData.getUsername());
        TextInputAction passwortAction = new TextInputAction(PASSWORT_INPUT, userData.getPassword());
        TemplateAction clickAction = new TemplateAction(TemplateActionType.CLICK, ANMELDEN_BUTTON);
        return new TemplateAction[]{
                benutzernameAction,
                passwortAction,
                clickAction};
    }
}