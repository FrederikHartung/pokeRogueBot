package com.sfh.pokeRogueBot.stage.pokemonselection;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.*;
import org.springframework.stereotype.Component;

@Component
public class PokemonselectionStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/pokemonselection/screen.png";

    protected PokemonselectionStage(TemplatePathValidator pathValidator) {
        super(pathValidator, PATH);
    }


    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "pokemonselection-generationSelector",
                        "./data/templates/pokemonselection/generationSelector.png",
                        false),
                new SimpleCvTemplate(
                        "pokemonselection-in",
                        "./data/templates/pokemonselection/in.png",
                        false),
                new SimpleCvTemplate(
                        "pokemonselection-number",
                        "./data/templates/pokemonselection/number.png",
                        false),
                new SimpleCvTemplate(
                        "pokemonselection-starter",
                        "./data/templates/pokemonselection/starter.png",
                        false),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        PressKeyAction pressSpace = new PressKeyAction(this, KeyToPress.SPACE);
        PressKeyAction pressArrowDown = new PressKeyAction(this, KeyToPress.ARROW_DOWN);
        PressKeyAction pressArrowRight = new PressKeyAction(this, KeyToPress.ARROW_RIGHT);
        PressKeyAction pressArrowLeft = new PressKeyAction(this, KeyToPress.ARROW_LEFT);
        WaitAction waitAction = new WaitAction();

        return new TemplateAction[]{
                pressArrowRight,
                waitAction,
                pressSpace, //green
                waitAction,
                pressSpace, //confirm
                waitAction,
                pressArrowRight,
                waitAction,
                pressSpace, //red
                waitAction,
                pressSpace, //confirm
                waitAction,
                pressArrowRight,
                waitAction,
                pressSpace, //blue
                waitAction,
                pressSpace, //confirm
                waitAction,
                pressArrowLeft,
                waitAction,
                pressArrowLeft,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowDown,
                waitAction,
                pressArrowLeft,
                waitAction,
                pressSpace, //start game
                waitAction,
                pressSpace, //start confirm
                waitAction,
                pressSpace, //chose saveslot
                waitAction,
                pressSpace, //confirm
                new WaitForRenderAction(),
                new TakeScreenshotAction(this)
        };
    }
}
