package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.model.cv.Point;
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


    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "fight-switch-pokemon",
                        "data/templates/fight/fight-switch-pokemon.png",
                        true,
                        new Point(-1, -1)
                ),
                new SimpleCvTemplate(
                        "fight-auswechseln-text",
                        "data/templates/fight/fight-auswechseln-text.png",
                        true,
                        new Point(-1, -1)
                ),
                new SimpleCvTemplate(
                        "fight-first-word-text",
                        "data/templates/fight/fight-first-word-text.png",
                        true,
                        new Point(-1, -1)
                ),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[0];
    }


    @Override
    public Template[] getOptionalTemplatesToAnalyseStage() {
        return new Template[0];
    }
}
