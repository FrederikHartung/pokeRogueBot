package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.model.enums.TemplateActionType;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameCvTemplate;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameOcrTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.*;
import org.springframework.stereotype.Component;

@Component
public class StartGameStage extends BaseStage implements Stage {

    public StartGameStage(TemplatePathValidator templatePathValidator) {
        super(templatePathValidator, PATH);
    }

    public static final String PATH = "./data/templates/startgame/startgame-screen.png";

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
        };
    }
}
