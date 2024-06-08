package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.stereotype.Component;

@Component
public class ShopStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/shop/shop-screen.png";

    private final DecisionService decisionService;

    protected ShopStage(DecisionService decisionService) {
        super(PATH);
        this.decisionService = decisionService;
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "shop-text",
                        "./data/templates/shop/text.png",
                        false,
                        false,
                        new Point(45, 531)
                )
        };
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
