package com.sfh.pokeRogueBot.stage.switchpokemon;

import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class SwitchPokemonStage extends BaseStage implements Stage {

    private static final String PATH = "";

    protected SwitchPokemonStage(String path) {
        super(PATH);
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[0];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[0];
    }

    @Override
    public boolean getPersistIfFound() {
        return false;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return false;
    }
}
