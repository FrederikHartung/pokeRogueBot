package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.HasOptionalTemplates;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class FightStage extends BaseStage implements Stage, HasOptionalTemplates {

    public FightStage(TemplatePathValidator templatePathValidator) {
        super(templatePathValidator, PATH);
    }

    public static final String PATH = "./data/templates/fight/fight-screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = true;

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "fight-auswechseln-text",
                        "data/templates/fight/fight-auswechseln-text.png",
                        false,
                        true,
                        new Point(258, 728)
                ),
                new SimpleCvTemplate(
                        "fight-first-word-text",
                        "data/templates/fight/fight-first-word-text.png",
                        false,
                        true,
                        new Point(43, 649)
                ),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[0];
    }


    @Override
    public Template[] getOptionalTemplatesToAnalyseStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "fight-switch-pokemon-decision",
                        "data/templates/fight/fight-switch-pokemon-decision.png",
                        false,
                        true,
                        new Point(1282, 424)
                )
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
