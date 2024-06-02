package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.SimpleTemplateAction;

public class SavegameStage implements Stage {
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

    @Override
    public String getTemplatePath() {
        return "";
    }

    @Override
    public String getFilenamePrefix() {
        return "";
    }
}
