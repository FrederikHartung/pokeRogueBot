package com.sfh.pokeRogueBot.stage.fight;

import com.sfh.pokeRogueBot.TestImageService;
import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.DecisionService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.stage.start.IntroStage;
import com.sfh.pokeRogueBot.stage.start.LoginScreenStage;
import com.sfh.pokeRogueBot.stage.start.MainMenuStage;
import com.sfh.pokeRogueBot.stage.start.PokemonselectionStage;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.TemplateUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class FightStageCvTest {

    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();

    OpenCvClient openCvClient = new OpenCvClient(
            singletonBeanConfig.getCvProcessingAlgorithm(),
            new CvResultFilehandler(),
            5);
    CvService cvService = new OpenCvService(mock(ImageService.class), openCvClient);
    DecisionService decisionService = mock(DecisionService.class);
    FightStage fightStage = new FightStage(decisionService);

    @BeforeAll
    static void setup(){
        TempFileManager tempFileManager = new TempFileManager();
        tempFileManager.deleteTempData();
    }

    @Test
    void find_all_templates(){
        boolean persistResults = false;
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(fightStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNotNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

    @Test
    void dont_find_any_login_stage_templates(){
        boolean persistResults = false;
        LoginScreenStage loginScreenStage = new LoginScreenStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(loginScreenStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);

            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

    @Test
    void dont_find_any_intro_stage_templates(){
        boolean persistResults = false;
        IntroStage introStage = new IntroStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(introStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

    @Test
    void dont_find_any_mainmenu_stage_templates(){
        boolean persistResults = false;
        MainMenuStage mainMenuStage = new MainMenuStage(mock(CvService.class), false, false);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(mainMenuStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

    @Test
    void dont_find_any_monsterselection_stage_templates(){
        boolean persistResults = false;
        PokemonselectionStage pokemonselectionStage = new PokemonselectionStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(pokemonselectionStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

    @Test
    void dont_find_any_switchdecision_stage_templates(){
        boolean persistResults = false;
        SwitchDecisionStage switchDecisionStage = new SwitchDecisionStage(decisionService);
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(switchDecisionStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            //persist results for debugging
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(fightStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }
}
