package com.sfh.pokeRogueBot.stage.switchdesicion;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class SwitchDecisionStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/switchdecision/screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = false;

    private final DecisionService decisionService;

    protected SwitchDecisionStage(TemplatePathValidator pathValidator, DecisionService decisionService) {
        super(pathValidator, PATH);
        this.decisionService = decisionService;
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[]{
                new SimpleCvTemplate(
                        "switchdesicion-question",
                        "./data/templates/switchdecision/question.png",
                        true,
                        true,
                        new Point(1282, 424)),
                new SimpleCvTemplate(
                        "switchdesicion-first-word-text",
                        "./data/templates/switchdecision/first-word-text.png",
                        true,
                        true,
                        new Point(43, 649)),
                new SimpleCvTemplate(
                        "switchdesicion-last-word-text",
                        "./data/templates/switchdecision/last-word-text.png",
                        true,
                        true,
                        new Point(258, 728)),
                new SwitchDesicionOcrTemplate(
                    "./data/templates/switchdecision/ocr-text.png",
                    new OcrPosition( new Point(43, 649),
                    new Size(258, 728)),
                    0.7,
                    false),
        };
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        List<TemplateAction> actions = new LinkedList<>();

        if(decisionService.shouldSwitchPokemon()){
            actions.add(pressSpace); //switch pokemon
        }
        else{
            actions.add(pressArrowDown); //dont switch pokemon
            actions.add(waitAction);
            actions.add(pressSpace);
        }

        return actions.toArray(new TemplateAction[0]);
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
