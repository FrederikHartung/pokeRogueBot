package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.reflections.Reflections;
import org.reflections.scanners.SubTypesScanner;
import org.reflections.util.ClasspathHelper;
import org.reflections.util.ConfigurationBuilder;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
public class TemplateManager {

    private final List<Template> templates = new LinkedList<>();

    public void checkIfAllTemplatesArePresent () throws TemplateNotFoundException {
        importAllTemplates();

        boolean aTemplateWasNotFound = false;
        for (Template template : templates) {
            File file = new File(template.getTemplatePath());
            if (!file.exists()) {
                log.error("Template not found: " + template.getTemplatePath());
                aTemplateWasNotFound = true;
            }
        }

        if(aTemplateWasNotFound) {
            throw new TemplateNotFoundException("Not all templates were found");
        }

        log.debug("imported templates: " + templates.size());
    }

    private void importAllTemplates() {
        Reflections reflections = new Reflections(new ConfigurationBuilder()
                .setUrls(ClasspathHelper.forJavaClassPath())
                .setScanners(new SubTypesScanner(false)));

        Set<Class<? extends Template>> classes = reflections.getSubTypesOf(Template.class);
        for (Class<? extends Template> aClass : classes) {
            try {
                templates.add(aClass.newInstance());
            } catch (InstantiationException | IllegalAccessException e) {
                log.error("Error while importing templates: " + e.getMessage(), e);
            }
        }
    }
}
