package com.sfh.pokeRogueBot.stage.pokemonselection;

import com.sfh.pokeRogueBot.model.cv.Point;
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
                        false,
                        new Point(-1, -1)),
                new SimpleCvTemplate(
                        "pokemonselection-in",
                        "./data/templates/pokemonselection/in.png",
                        false,
                        new Point(-1, -1)),
                new SimpleCvTemplate(
                        "pokemonselection-number",
                        "./data/templates/pokemonselection/number.png",
                        false,
                        new Point(-1, -1)),
                new SimpleCvTemplate(
                        "pokemonselection-starter",
                        "./data/templates/pokemonselection/starter.png",
                        false,
                        new Point(-1, -1)),
        };
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
