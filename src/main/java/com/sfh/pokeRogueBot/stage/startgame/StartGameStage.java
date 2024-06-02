package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameCvTemplate;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameOcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.*;

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
/*                new PressKeyActionSimple(this, KeyToPress.ARROW_DOWN),
                new PressKeyActionSimple(this, KeyToPress.SPACE),
                new SimpleTemplateAction(TemplateActionType.WAIT_FOR_RENDER, this), //wait to render
                new SimpleTemplateAction(TemplateActionType.TAKE_SCREENSHOT, this), //savegame menue*/
                //todo: check if savegame is available
                new PressKeyActionSimple(this, KeyToPress.SPACE),
                new WaitForRenderAction(),
                new TakeScreenshotAction(this)
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
