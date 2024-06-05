package com.sfh.pokeRogueBot.stage.savegame;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;
import org.springframework.stereotype.Component;

@Component
public class SavegameStage extends BaseStage implements Stage {

    public SavegameStage(TemplatePathValidator pathValidator) {
        super(pathValidator, PATH);
    }

    private static final String PATH = "./data/templates/savegame/savegame-screen.png";

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "savegame-cornerTL",
                        "./data/templates/savegame/savegame-cornerTL.png",
                        true,
                        false,
                        new Point(-1, -1)
                        ),
                new SimpleCvTemplate(
                        "savegame-cornerBR",
                        "./data/templates/savegame/savegame-cornerBR.png",
                        true,
                        false,
                        new Point(-1, -1)
                )
        };
    }

    @Override
    public SimpleTemplateAction[] getTemplateActionsToPerform() {
        return new SimpleTemplateAction[0];
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
