package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.model.enums.TemplateIdentificationType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import com.sfh.pokeRogueBot.stage.login.templates.AnmeldenButtonTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.BenutzernameInputTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.PasswortInputTemplate;
import com.sfh.pokeRogueBot.template.actions.TextInputTemplateAction;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
public class LoginScreenStage implements Template, Stage {

    public static final String PATH = "./data/templates/login/login-screen.png";
    public static final String XPATH = "//*[@id=\"app\"]/div";

    public static final AnmeldenButtonTemplate ANMELDEN_BUTTON = new AnmeldenButtonTemplate();
    public static final BenutzernameInputTemplate BENUTZERNAME_INPUT = new BenutzernameInputTemplate();
    public static final PasswortInputTemplate PASSWORT_INPUT = new PasswortInputTemplate();

    private UserData userData;

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
        if(userData == null){
            throw new IllegalStateException("UserData must be set before calling getTemplateActionsToPerform. Use the allArgsConstructor to set the userData.");
        }

        TextInputTemplateAction benutzernameAction = new TextInputTemplateAction(BENUTZERNAME_INPUT, userData.getUsername());
        TextInputTemplateAction passwortAction = new TextInputTemplateAction(PASSWORT_INPUT, userData.getPassword());
        TemplateAction waitAction = new TemplateAction(TemplateActionType.WAIT, null);
        TemplateAction screenshotAction = new TemplateAction(TemplateActionType.TAKE_SCREENSHOT, this);
        return new TemplateAction[]{benutzernameAction, passwortAction, waitAction, screenshotAction};
    }

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}