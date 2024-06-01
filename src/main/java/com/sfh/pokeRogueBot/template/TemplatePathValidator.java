package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenCvTemplate;
import com.sfh.pokeRogueBot.stage.intro.templates.IntroScreenTextTemplate;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.login.templates.*;
import com.sfh.pokeRogueBot.stage.startgame.StartGameStage;
import com.sfh.pokeRogueBot.stage.startgame.templates.StartGameCvTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplatePathValidator {

    public List<String> getTemplatePaths() {
        List<String> templatePaths = new LinkedList<>();

        //log
        templatePaths.add(LoginScreenStage.PATH);
        templatePaths.add(AnmeldenButtonTemplate.PATH);
        templatePaths.add(RegistrierenButtonTemplate.PATH);
        templatePaths.add(BenutzernameTemplate.PATH);
        templatePaths.add(PasswordTemplate.PATH);
        templatePaths.add(BenutzernameInputTemplate.PATH);
        templatePaths.add(PasswortInputTemplate.PATH);

        //new game stage
        templatePaths.add(IntroStage.PATH);
        templatePaths.add(IntroScreenCvTemplate.PATH);
        templatePaths.add(IntroScreenTextTemplate.PATH);

        //startgame stage
        templatePaths.add(StartGameStage.PATH);
        templatePaths.add(StartGameCvTemplate.PATH);

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
