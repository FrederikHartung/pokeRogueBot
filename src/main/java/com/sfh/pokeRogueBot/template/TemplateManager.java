package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplateManager {

    private final List<Template> templates = new LinkedList<>();

    public TemplateManager(List<Template> templates) {
        this.templates.addAll(templates);
    }

    public void checkIfAllTemplatesArePresent () throws TemplateNotFoundException {
        boolean aTemplateWasNotFound = false;
        for (Template template : templates) {
            if (template.getTemplatePath() == null) {
                log.error("Template " + template.getClass().getSimpleName() + " was not found at path: " + template.getTemplatePath());
                aTemplateWasNotFound = true;
            }
        }

        if(aTemplateWasNotFound) {
            throw new TemplateNotFoundException("Not all templates were found");
        }
        log.debug("All templates were found");
    }
}
