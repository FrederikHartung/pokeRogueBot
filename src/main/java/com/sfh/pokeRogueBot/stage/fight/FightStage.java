package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.enums.FightDecision;
import com.sfh.pokeRogueBot.service.DecisionService;
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
public class FightStage extends BaseStage implements Stage {

    private final DecisionService decisionService;

    public static final String PATH = "./data/templates/fight/screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = true;

    public FightStage(DecisionService decisionService) {
        super(PATH);
        this.decisionService = decisionService;
    }


    @Override
    public boolean getPersistIfFound() {
        return PERSIST_IF_FOUND;
    }

    @Override
    public boolean getPersistIfNotFound() {
        return PERSIST_IF_NOT_FOUND;
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "fight-first-word-text",
                        "./data/templates/fight/fight-first-word-text.png",
                        false,
                        false,
                        new Point(31, 646)),
                new SimpleCvTemplate(
                        "fight-second-word-text",
                        "./data/templates/fight/fight-second-word-text.png",
                        false,
                        false,
                        new Point(237, 717)),
                new SimpleCvTemplate(
                        "fight-options",
                        "./data/templates/fight/fight-options.png",
                        false,
                        false,
                        new Point(991, 653)),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        List<TemplateAction> actions = new LinkedList<>();

        FightDecision fightDecision = decisionService.getFightDecision();
        if(fightDecision == FightDecision.ATTACK){
            actions.add(pressSpace);
            actions.add(waitAction);
            actions.add(pressSpace);
            actions.add(this.waitForStageRenderAction);
            actions.add(this.takeScreenshotAction);
        }

        return actions.toArray(new TemplateAction[0]);
    }

}
