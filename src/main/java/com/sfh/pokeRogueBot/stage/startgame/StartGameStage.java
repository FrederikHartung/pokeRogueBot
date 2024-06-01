package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class StartGameStage implements Stage {
    public static final String PATH = "./data/templates/startgame/startgame-screen.png";
    private static final String NAME = StartGameStage.class.getSimpleName();

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[0];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        TemplateAction screenAction = new TemplateAction(TemplateActionType.TAKE_SCREENSHOT, this);
        return new TemplateAction[]{
                screenAction,
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
