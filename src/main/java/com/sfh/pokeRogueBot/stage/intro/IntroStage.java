package com.sfh.pokeRogueBot.stage.intro;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenCvTemplate;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class IntroStage implements Stage {
    public static final String PATH = "./data/templates/intro/intro-screen.png";
    private static final String NAME = IntroStage.class.getSimpleName();

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new IntroScreenCvTemplate(),
                new IntroScreenTextTemplate(),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        TemplateAction pressSpaceAction = new PressKeyAction(this, KeyToPress.SPACE);
        TemplateAction waitAction = new TemplateAction(TemplateActionType.WAIT_LONGER, null);
        return new TemplateAction[] {
                pressSpaceAction, //welcome screen
                waitAction,
                pressSpaceAction, //not monetised screen
                waitAction,
                pressSpaceAction, //copyright screen
                waitAction,
                pressSpaceAction, //game is still in development screen
                waitAction,
                pressSpaceAction, //use discord for error reports screen
                waitAction,
                pressSpaceAction, //check hardware acceleration screen
                waitAction,
        };
    }

    @Override
    public String getTemplatePath() {
        return PATH;
    }

    @Override
    public String getFilenamePrefix() {
        return NAME;
    }
}
