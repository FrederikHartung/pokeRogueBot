package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.actions.TemplateAction;
import org.springframework.beans.factory.annotation.Qualifier;

public abstract class BaseStage implements Stage {

    private final String path;

    protected BaseStage(TemplatePathValidator pathValidator,
                     @Qualifier(value = "baseStagePathBean") String path) {
        this.path = path;
        pathValidator.addPath(path);
        for(Template template : getTemplatesToValidateStage()) {
            pathValidator.addPath(template.getTemplatePath());
        }
    }

    @Override
    public Template[] getTemplatesToValidateStage() {
        return new Template[0];
    }

    @Override
    public TemplateAction[] getTemplateActionsToPerform() {
        return new TemplateAction[0];
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
