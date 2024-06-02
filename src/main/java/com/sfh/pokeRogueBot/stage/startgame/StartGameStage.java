package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameCvTemplate;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameOcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.PressKeyAction;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class StartGameStage implements Stage {
    public static final String PATH = "./data/templates/startgame/startgame-screen.png";
    private static final String NAME = StartGameStage.class.getSimpleName();

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new StartGameCvTemplate(),
                new StartGameOcrTemplate(),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[]{
                new PressKeyAction(this, KeyToPress.ARROW_DOWN),
                new PressKeyAction(this, KeyToPress.SPACE),
                new TemplateAction(TemplateActionType.WAIT_FOR_RENDER, this), //wait to render
                new TemplateAction(TemplateActionType.TAKE_SCREENSHOT, this), //savegame menue
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
