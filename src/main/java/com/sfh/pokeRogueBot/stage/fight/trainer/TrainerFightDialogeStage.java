package com.sfh.pokeRogueBot.stage.fight.trainer;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.stereotype.Component;

@Component
public class TrainerFightDialogeStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/trainerfight_dialoge/screen.png";

    private final boolean persistIfFound = false;
    private final boolean persistIfNotFound = false;

    public TrainerFightDialogeStage() {
        super(PATH);
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "trainer-fight-dialoge-name-shield-left",
                        "./data/templates/trainerfight_dialoge/name-shield-left.png",
                        false,
                        false,
                        new Point(46,567)
                ),
                new SimpleCvTemplate(
                        "trainer-fight-dialoge-name-shield-right",
                        "./data/templates/trainerfight_dialoge/name-shield-right.png",
                        false,
                        false,
                        new Point(338,572)
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
