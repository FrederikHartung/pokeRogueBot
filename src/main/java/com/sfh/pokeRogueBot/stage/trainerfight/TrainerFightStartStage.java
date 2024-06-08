package com.sfh.pokeRogueBot.stage.trainerfight;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TrainerFightStartStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/trainerfight_start/stage.png";

    private final boolean persistIfFound = false;
    private final boolean persistIfNotFound = false;

    protected TrainerFightStartStage() {
        super(PATH);
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "trainer-fight-text-cv",
                        "./data/templates/trainerfight_start/text-cv.png",
                        false,
                        false,
                        new Point(35, 721)
                ),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        List<TemplateAction> actions = new LinkedList<>();
        actions.add(this.pressSpace);

        return actions.toArray(new TemplateAction[0]);
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
