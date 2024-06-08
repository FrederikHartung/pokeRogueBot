package com.sfh.pokeRogueBot.stage.start;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.config.UserDataProvider;
import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.start.templates.AnmeldenButtonTemplate;
import com.sfh.pokeRogueBot.stage.start.templates.BenutzernameInputTemplate;
import com.sfh.pokeRogueBot.stage.start.templates.PasswortInputTemplate;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;
import com.sfh.pokeRogueBot.template.actions.TextInputActionSimple;
import org.springframework.stereotype.Component;

@Component
public class LoginScreenStage extends BaseStage implements HtmlTemplate, Stage {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final String XPATH = "//*[@id=\"app\"]/div";

    private static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate(false, false, new Point(524, 408));
    private static final BenutzernameInputTemplate BENUTZERNAME_INPUT = new BenutzernameInputTemplate();
    private static final PasswortInputTemplate PASSWORT_INPUT = new PasswortInputTemplate();

    public LoginScreenStage() {
        super(PATH);
    }

    @Override
    public String getXpath() {
        return XPATH;
    }

    @Override
    public boolean persistOnHtmlElementNotFound() {
        return false;
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
                        false,
                        false,
                        new Point(411, 225)),
                new SimpleCvTemplate(
                        "login-passwort",
                        "./data/templates/login/login-passwort.png",
                        false,
                        false,
                        new Point(419, 332)),
                new SimpleCvTemplate("login-registrieren",
                        "./data/templates/login/login-registrieren-button.png",
                        false,
                        false,
                        new Point(758, 413)),
        };
    }

    @Override
    public boolean getPersistIfFound() {
        return false;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return false;
    }

    @Override
    public SimpleTemplateAction[] getTemplateActionsToPerform() {
        UserData userData = UserDataProvider.getUserdata(Constants.PATH_TO_USER_DATA);

        TextInputActionSimple benutzernameAction = new TextInputActionSimple(BENUTZERNAME_INPUT, userData.getUsername());
        TextInputActionSimple passwortAction = new TextInputActionSimple(PASSWORT_INPUT, userData.getPassword());
        SimpleTemplateAction clickAction = new SimpleTemplateAction(TemplateActionType.CLICK, ANMELDEN_BUTTON);
        return new SimpleTemplateAction[]{
                benutzernameAction,
                passwortAction,
                clickAction};
    }
}