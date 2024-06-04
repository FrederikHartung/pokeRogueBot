package com.sfh.pokeRogueBot.stage.intro;

import com.sfh.pokeRogueBot.TestImageService;
import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.stage.FightStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.mainmenu.MainMenuStage;
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

class IntroStageCvTest {
    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();
    TemplatePathValidator validator = new TemplatePathValidator();
    IntroStage introStage = new IntroStage(validator);
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
        boolean persistResults = true;
        Template[] templates = introStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(introStage.getTemplatePath());
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
        Template[] templates = loginScreenStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(introStage.getTemplatePath());
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
    void dont_find_any_mainmenu_stage_templates(){
        boolean persistResults = false;
        MainMenuStage mainMenuStage = new MainMenuStage(validator, mock(CvService.class), false);
        Template[] templates = mainMenuStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(introStage.getTemplatePath());
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
    void dont_find_any_pokemonselection_stage_templates(){
        boolean persistResults = false;
        PokemonselectionStage pokemonselectionStage = new PokemonselectionStage(validator);
        Template[] templates = pokemonselectionStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(introStage.getTemplatePath());
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
        Template[] templates = fightStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(introStage.getTemplatePath());
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
