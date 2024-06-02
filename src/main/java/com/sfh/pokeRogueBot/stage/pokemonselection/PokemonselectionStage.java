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
        PressKeyActionSimple pressSpace = new PressKeyActionSimple(this, KeyToPress.SPACE);
        WaitAction waitAction = new WaitAction();
        TakeScreenshotAction takeScreenshotAction = new TakeScreenshotAction(this);
        return new TemplateAction[]{
                pressSpace,
                waitAction,
                pressSpace,
                waitAction,
                pressSpace,
                waitAction,
                takeScreenshotAction
        };
    }
}
