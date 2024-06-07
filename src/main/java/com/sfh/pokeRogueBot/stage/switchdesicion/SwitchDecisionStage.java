package com.sfh.pokeRogueBot.stage.switchdesicion;

import com.sfh.pokeRogueBot.model.cv.OcrPosition;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.stage.BaseStage;
import com.sfh.pokeRogueBot.stage.Stage;
import com.sfh.pokeRogueBot.template.SimpleCvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class SwitchDecisionStage extends BaseStage implements Stage {

    private static final String PATH = "./data/templates/switchdecision/screen.png";
    private static final boolean PERSIST_IF_FOUND = false;
    private static final boolean PERSIST_IF_NOT_FOUND = false;

    protected SwitchDecisionStage(TemplatePathValidator pathValidator) {
        super(pathValidator, PATH);
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
        return new TemplateAction[0];
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
