package com.sfh.pokeRogueBot.template;

import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.stage.SavegameStage;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.startgame.StartGameStage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;

@Slf4j
@Component
public class TemplatePathValidator {

    public List<String> getTemplatePaths() {
        List<String> templatePaths = new LinkedList<>();

        //login stage
        LoginScreenStage loginScreenStage = new LoginScreenStage();
        templatePaths.add(loginScreenStage.getTemplatePath());
        templatePaths.addAll(Arrays.stream(loginScreenStage.getTemplatesToValidateStage()).map(Template::getTemplatePath).toList());

        //intro stage
        IntroStage introStage = new IntroStage();
        templatePaths.add(introStage.getTemplatePath());
        templatePaths.addAll(Arrays.stream(introStage.getTemplatesToValidateStage()).map(Template::getTemplatePath).toList());

        //startgame stage
        StartGameStage startGameStage = new StartGameStage();
        templatePaths.add(startGameStage.getTemplatePath());
        templatePaths.addAll(Arrays.stream(startGameStage.getTemplatesToValidateStage()).map(Template::getTemplatePath).toList());

        //savegame stage
        SavegameStage savegameStage = new SavegameStage();
        templatePaths.add(savegameStage.getTemplatePath());
        templatePaths.addAll(Arrays.stream(savegameStage.getTemplatesToValidateStage()).map(Template::getTemplatePath).toList());

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
