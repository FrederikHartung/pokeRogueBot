package com.sfh.pokeRogueBot.stage.mainmenu;

import com.sfh.pokeRogueBot.TestImageService;
import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.stage.fight.FightStage;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.pokemonselection.PokemonselectionStage;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.TemplateUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class MainMenuStageCvTest {

    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();
    TemplatePathValidator validator = new TemplatePathValidator();
    MainMenuStage mainMenuStage = new MainMenuStage(validator, mock(CvService.class), false);
    OpenCvClient openCvClient = new OpenCvClient(
            singletonBeanConfig.getCvProcessingAlgorithm(),
            new CvResultFilehandler(),
            5);
    CvService cvService = new OpenCvService(mock(ImageService.class), openCvClient);

    @BeforeAll
    static void setup(){
        TempFileManager tempFileManager = new TempFileManager();
        tempFileManager.deleteTempData();
    }

    @Test
    void find_all_templates(){
        boolean persistResults = false;
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(mainMenuStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(mainMenuStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNotNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                e.printStackTrace();
                fail("Error checking template: " + cvTemplate.getFilenamePrefix());
            }
        }
    }

    @Test
    void dont_find_any_login_stage_templates(){
        boolean persistResults = false;
        LoginScreenStage loginScreenStage = new LoginScreenStage(validator);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(loginScreenStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(mainMenuStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                e.printStackTrace();
                fail("Error checking template: " + cvTemplate.getFilenamePrefix());
            }
        }
    }

    @Test
    void dont_find_any_intro_stage_templates(){
        boolean persistResults = false;
        IntroStage introStage = new IntroStage(validator);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(introStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(mainMenuStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                e.printStackTrace();
                fail("Error checking template: " + cvTemplate.getFilenamePrefix());
            }
        }
    }

    @Test
    void dont_find_any_monsterselection_stage_templates(){
        boolean persistResults = false;
        PokemonselectionStage pokemonselectionStage = new PokemonselectionStage(validator);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(pokemonselectionStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(mainMenuStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                e.printStackTrace();
                fail("Error checking template: " + cvTemplate.getFilenamePrefix());
            }
        }
    }

    @Test
    void dont_find_any_fight_stage_templates(){
        boolean persistResults = false;
        FightStage fightStage = new FightStage(validator);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(fightStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(mainMenuStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                e.printStackTrace();
                fail("Error checking template: " + cvTemplate.getFilenamePrefix());
            }
        }
    }
}
