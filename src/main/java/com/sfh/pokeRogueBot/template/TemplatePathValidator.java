package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.HasOptionalTemplates;
import com.sfh.pokeRogueBot.stage.Stage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.Collection;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplatePathValidator {

    private final List<String> paths = new LinkedList<>();

    public TemplatePathValidator(ConfigurableApplicationContext context) {

        Collection<Stage> stages = context.getBeansOfType(Stage.class).values();
        for(Stage stage: stages) {
            for(Template template : stage.getTemplatesToValidateStage()) {
                paths.add(template.getTemplatePath());
            }
            if(this instanceof HasOptionalTemplates optionalTemplates) {
                for(Template template : optionalTemplates.getOptionalTemplatesToAnalyseStage()) {
                    paths.add(template.getTemplatePath());
                }
            }
        }
    }

    public void checkIfAllTemplatesArePresent () throws TemplateNotFoundException {
        boolean aTemplateWasNotFound = false;
        for (String templatePath : paths) {
            File file = new File(templatePath);
            if (!file.exists()) {
                log.error("Template not found: " + templatePath);
                aTemplateWasNotFound = true;
            }
        }

        if(aTemplateWasNotFound) {
            throw new TemplateNotFoundException("Not all templates were found");
        }

        log.debug("imported templates: " + paths.size());
    }
}
