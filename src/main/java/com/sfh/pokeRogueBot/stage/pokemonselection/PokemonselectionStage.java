package com.sfh.pokeRogueBot.stage.pokemonselection;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.stereotype.Component;

@Component
public class PokemonselectionStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/pokemonselection/screen.png";

    public PokemonselectionStage() {
        super(PATH);
    }


    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "pokemonselection-generationSelector",
                        "./data/templates/pokemonselection/generationSelector.png",
                        false,
                        false,
                        new Point(505, 17)),
                new SimpleCvTemplate(
                        "pokemonselection-in",
                        "./data/templates/pokemonselection/in.png",
                        false,
                        false,
                        new Point(16, 640)),
                new SimpleCvTemplate(
                        "pokemonselection-number",
                        "./data/templates/pokemonselection/number.png",
                        false,
                        false,
                        new Point(19, 10)),
                new SimpleCvTemplate(
                        "pokemonselection-starter",
                        "./data/templates/pokemonselection/starter.png",
                        false,
                        false,
                        new Point(706, 72)),
        };
    }

    @Override
    public boolean getPersistIfFound() {
        return false;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return false;
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {

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
                waitForTextRenderAction,
                pressSpace, //start confirm
                waitForTextRenderAction,
                pressSpace, //chose saveslot
                waitForTextRenderAction,
                pressSpace, //confirm
        };
    }
}
