package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
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
