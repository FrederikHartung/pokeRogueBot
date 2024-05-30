package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.login.templates.AnmeldenButtonTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.BenutzernameInputTemplate;
import com.sfh.pokeRogueBot.stage.login.templates.PasswortInputTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplateManager {


    public List<String> getTemplatePaths() {
        List<String> templatePaths = new LinkedList<>();

        //login stage
        templatePaths.add(LoginScreenStage.PATH);
        templatePaths.add(AnmeldenButtonTemplate.PATH);
        templatePaths.add(BenutzernameInputTemplate.PATH);
        templatePaths.add(PasswortInputTemplate.PATH);

        return templatePaths;
    }

    public void checkIfAllTemplatesArePresent () throws TemplateNotFoundException {
        List<String> templatePaths = getTemplatePaths();

        boolean aTemplateWasNotFound = false;
        for (String templatePath : templatePaths) {
            File file = new File(templatePath);
            if (!file.exists()) {
                log.error("Template not found: " + templatePath);
                aTemplateWasNotFound = true;
            }
        }

        if(aTemplateWasNotFound) {
            throw new TemplateNotFoundException("Not all templates were found");
        }

        log.debug("imported templates: " + templatePaths.size());
    }
}
