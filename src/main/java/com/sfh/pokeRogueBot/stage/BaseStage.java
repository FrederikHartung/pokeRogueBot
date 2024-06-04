package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.model.enums.KeyToPress;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.*;
import org.springframework.beans.factory.annotation.Qualifier;

public abstract class BaseStage implements Stage {

    private final String path;

    protected final PressKeyAction pressSpace = new PressKeyAction(this, KeyToPress.SPACE);
    protected final PressKeyAction pressBackspace = new PressKeyAction(this, KeyToPress.BACK_SPACE);
    protected final PressKeyAction pressArrowUp = new PressKeyAction(this, KeyToPress.ARROW_UP);
    protected final PressKeyAction pressArrowRight = new PressKeyAction(this, KeyToPress.ARROW_RIGHT);
    protected final PressKeyAction pressArrowDown = new PressKeyAction(this, KeyToPress.ARROW_DOWN);
    protected final PressKeyAction pressArrowLeft = new PressKeyAction(this, KeyToPress.ARROW_LEFT);
    protected final WaitAction waitAction = new WaitAction();
    protected final WaitForTextRenderAction waitForTextRenderAction = new WaitForTextRenderAction();
    protected final WaitForStageRenderAction waitForStageRenderAction = new WaitForStageRenderAction();
    protected final TakeScreenshotAction takeScreenshotAction = new TakeScreenshotAction(this);

    protected BaseStage(
            TemplatePathValidator pathValidator,
            @Qualifier(value = "baseStagePathBean") String path) {
        this.path = path;
        pathValidator.addPath(path);
        for(Template template : getTemplatesToValidateStage()) {
            pathValidator.addPath(template.getTemplatePath());
        }
        if(this instanceof HasOptionalTemplates optionalTemplates) {
            for(Template template : optionalTemplates.getOptionalTemplatesToAnalyseStage()) {
                pathValidator.addPath(template.getTemplatePath());
            }
        }
    }

    @Override
    public String getTemplatePath() {
        return path;
    }

    @Override
    public String getFilenamePrefix() {
        return this.getClass().getSimpleName();
    }
}
