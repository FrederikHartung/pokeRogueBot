package com.sfh.pokeRogueBot.stage.savegame;

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
                        true),
                new SimpleCvTemplate(
                        "savegame-cornerBR",
                        "./data/templates/savegame/savegame-cornerBR.png",
                        true)
        };
    }

    @Override
    public SimpleTemplateAction[] getTemplateActionsToPerform() {
        return new SimpleTemplateAction[0];
    }
}
