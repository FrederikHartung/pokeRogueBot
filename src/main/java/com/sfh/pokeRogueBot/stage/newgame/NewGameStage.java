package com.sfh.pokeRogueBot.stage.newgame;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.newgame.templates.IntroScreenTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class NewGameStage implements Stage {
    public static final String PATH = "./data/templates/newgame/newgame-screen.png";
    private static final String NAME = NewGameStage.class.getSimpleName();

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{new IntroScreenTemplate()};
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        TemplateAction pressSpaceAction = new PressKeyAction(this, KeyToPress.SPACE);
        TemplateAction waitAction = new TemplateAction(TemplateActionType.WAIT_LONGER, null);
        return new TemplateAction[] {
                pressSpaceAction, //welcome screen
                waitAction
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

    @Override
    public boolean persistResultWhenFindingTemplate() {
        return false;
    }
}
