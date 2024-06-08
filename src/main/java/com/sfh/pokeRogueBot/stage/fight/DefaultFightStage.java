package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.stereotype.Component;

@Component
public class DefaultFightStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/default-fight-stage/screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = true;

    protected DefaultFightStage() {
        super(PATH);
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "default-fight-stage-exp",
                        "./data/templates/default-fight-stage/exp.png",
                        false,
                        false,
                        new Point(932, 554)
                ),
                new SimpleCvTemplate(
                        "default-fight-stage-health",
                        "./data/templates/default-fight-stage/health.png",
                        false,
                        false,
                        new Point(1271, 521)
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
        return PERSIST_IF_FOUND;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return PERSIST_IF_NOT_FOUND;
    }
}
