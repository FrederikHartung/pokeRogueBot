package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.HtmlTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.stage.login.templates.AnmeldenButtonTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.BenutzernameInputTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.PasswortInputTemplate;
import com.sfh.pokeRogueBot.template.actions.TextInputTemplateAction;

public class LoginScreenStage implements HtmlTemplate, Stage {

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

    /**
     * return the templates that are used to validate that the stage
     */
    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{BENUTZERNAME_INPUT, PASSWORT_INPUT, ANMELDEN_BUTTON};
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        if(userData == null){
            throw new IllegalStateException("UserData must be set before calling getTemplateActionsToPerform. Use the allArgsConstructor to set the userData.");
        }

        TextInputTemplateAction benutzernameAction = new TextInputTemplateAction(BENUTZERNAME_INPUT, userData.getUsername());
        TextInputTemplateAction passwortAction = new TextInputTemplateAction(PASSWORT_INPUT, userData.getPassword());
        TemplateAction clickAction = new TemplateAction(TemplateActionType.CLICK, ANMELDEN_BUTTON);
        TemplateAction waitAction = new TemplateAction(TemplateActionType.WAIT, null);
        TemplateAction screnshotAction = new TemplateAction(TemplateActionType.TAKE_SCREENSHOT, null);
        return new TemplateAction[]{benutzernameAction, passwortAction, clickAction, waitAction, screnshotAction};
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}