package com.sfh.pokeRogueBot.stage.shop;

import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;

public class ShopStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/shop/shop-screen.png";

    protected ShopStage() {
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
        return true;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return false;
    }
}
