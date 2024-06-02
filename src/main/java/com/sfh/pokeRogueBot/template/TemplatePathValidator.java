package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplatePathValidator {

    private static final List<String> TEMPLATE_PATHS = new LinkedList<>();

    public void addPath(String path) {
        TEMPLATE_PATHS.add(path);
    }

    public void checkIfAllTemplatesArePresent () throws TemplateNotFoundException {
        boolean aTemplateWasNotFound = false;
        for (String templatePath : TEMPLATE_PATHS) {
            File file = new File(templatePath);
            if (!file.exists()) {
                log.error("Template not found: " + templatePath);
                aTemplateWasNotFound = true;
            }
        }

        if(aTemplateWasNotFound) {
            throw new TemplateNotFoundException("Not all templates were found");
        }

        log.debug("imported templates: " + TEMPLATE_PATHS.size());
    }
}
