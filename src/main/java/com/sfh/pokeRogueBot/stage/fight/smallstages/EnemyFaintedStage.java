package com.sfh.pokeRogueBot.stage.fight.smallstages;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class EnemyFaintedStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/enemy_pokemon_fainted/screen.png";

    private final boolean persistIfFound = true;
    private final boolean persistIfNotFound = false;

    public EnemyFaintedStage() {
        super(PATH);
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "enemy_pokemon_fainted",
                        "./data/templates/enemy_pokemon_fainted/enemy-fainted-text.png",
                        true,
                        true,
                        new Point(234, 649)
                )
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[]{
                this.pressSpace
        };
    }

    @Override
    public boolean getPersistIfFound() {
        return persistIfFound;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return persistIfNotFound;
    }
}
