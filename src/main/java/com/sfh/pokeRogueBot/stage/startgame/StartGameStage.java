package com.sfh.pokeRogueBot.stage.startgame;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
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
        PressKeyAction pressSpace = new PressKeyAction(this, KeyToPress.SPACE);
        PressKeyAction pressArrowDown = new PressKeyAction(this, KeyToPress.ARROW_DOWN);
        PressKeyAction pressArrowLeftForDeactivation = new PressKeyAction(this, KeyToPress.ARROW_LEFT);
        PressKeyAction pressArrowUp = new PressKeyAction(this, KeyToPress.ARROW_UP);
        WaitAction waitAction = new WaitAction();

        return new TemplateAction[]{
/*                new PressKeyAction(this, KeyToPress.ARROW_DOWN),
                new PressKeyAction(this, KeyToPress.SPACE),
                new SimpleTemplateAction(TemplateActionType.WAIT_FOR_RENDER, this), //wait to render
                new SimpleTemplateAction(TemplateActionType.TAKE_SCREENSHOT, this), //savegame menue*/
                //todo: check if savegame is available

                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressSpace, //enter config menue
                new WaitForRenderAction(), // now on game speed
                pressArrowDown, //master volume
                waitAction,
                pressArrowDown, //bgm volume
                waitAction,
                pressArrowDown, //SE volume
                waitAction,
                pressArrowDown, //language
                waitAction,
                pressArrowDown, //damage numbers
                waitAction,
                pressArrowDown, //UI theme
                waitAction,
                pressArrowDown, //window type
                waitAction,
                pressArrowDown, // now on tutorials
                waitAction,
                pressArrowLeftForDeactivation, //disable tutorials
                waitAction,
                pressArrowDown, //enable retries
                waitAction,
                pressArrowDown, //candy upgrade notification
                waitAction,
                pressArrowDown, //candy upgrade display
                waitAction,
                pressArrowDown, //money format
                waitAction,
                pressArrowDown, //sprite set
                waitAction,
                pressArrowDown, //now on move animations
                waitAction,
                pressArrowLeftForDeactivation, //disable move animations
                waitAction,
                pressArrowDown, //show moveset animations
                waitAction,
                pressArrowLeftForDeactivation, //disable moveset animations
                waitAction,
                new PressKeyAction(this, KeyToPress.BACK_SPACE), //return to main menue
                new WaitForRenderAction(),
                pressArrowUp, //
                waitAction,
                pressArrowUp, //
                waitAction,
                pressArrowUp, //new game
                pressSpace, //start new game
        };
    }
}
