package com.sfh.pokeRogueBot.stage;

import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.stage.intro.IntroStage;
import com.sfh.pokeRogueBot.stage.login.LoginScreenStage;
import com.sfh.pokeRogueBot.template.*;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

class CvTest {

    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();
    ImageService imageService = mock(ImageService.class);


    CvService cvService = new OpenCvService(
            1,
            1000,
            imageService,
            new OpenCvClient(singletonBeanConfig.getCvProcessingAlgorithm())
    );

    @Test
    void test_if_all_templates_positins_are_correct() {

        TemplatePathValidator validator = new TemplatePathValidator();
        Stage [] stages = new Stage[]{
                new IntroStage(new TemplatePathValidator()),
                new LoginScreenStage(new TemplatePathValidator())
        };

        boolean persistResults = true;

        for(Stage stage:stages){
            Template[] templates = stage.getTemplatesToValidateStage();
            List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);
            for (CvTemplate cvTemplate : cvTemplates) {
                try{
                    cvTemplate.setPersistResultWhenFindingTemplate(persistResults);
                    File fileStage = new File(stage.getStagePath());
                    BufferedImage bufferedImageStage = ImageIO.read(fileStage);
                    assertNotNull(bufferedImageStage, "Image not found: " + stage.getStagePath());
                    doReturn(bufferedImageStage).when(imageService).takeScreenshot(cvTemplate.getFilenamePrefix());

                    File fileTemplate = new File(cvTemplate.getTemplatePath());
                    BufferedImage bufferedImageTemplate = ImageIO.read(fileTemplate);
                    assertNotNull(bufferedImageTemplate, "Template not found: " + cvTemplate.getTemplatePath());
                    doReturn(bufferedImageTemplate).when(imageService).loadTemplate(cvTemplate.getTemplatePath());

                    CvResult result = cvService.findTemplate(cvTemplate);
                    assertNotNull(result, "Template not found in image: " + cvTemplate.getFilenamePrefix());
                    assertEquals(cvTemplate.getTopLeft().getX(), result.getTopLeft().getX());
                    assertEquals(cvTemplate.getTopLeft().getY(), result.getTopLeft().getY());
                }catch (Exception e) {
                    fail("Template not found in image: " + cvTemplate.getFilenamePrefix());
                }
            }
        }
    }

    /*@Test
    void test_if_the_templates_are_not_found_on_a_other_stage(){
        boolean persistResults = true;
        String stagePathIntroStage = IntroStage.PATH;
        for (CvTemplate cvTemplate : cvTemplates) {
            try{
                cvTemplate.setPersistResultWhenFindingTemplate(persistResults);
                File fileStage = new File(stagePathIntroStage);
                BufferedImage bufferedImageStage = ImageIO.read(fileStage);
                assertNotNull(bufferedImageStage, "Image not found: " + stagePathIntroStage);
                doReturn(bufferedImageStage).when(imageService).takeScreenshot(cvTemplate.getFilenamePrefix());

                File fileTemplate = new File(cvTemplate.getTemplatePath());
                BufferedImage bufferedImageTemplate = ImageIO.read(fileTemplate);
                assertNotNull(bufferedImageTemplate, "Template not found: " + cvTemplate.getTemplatePath());
                doReturn(bufferedImageTemplate).when(imageService).loadTemplate(cvTemplate.getTemplatePath());

                CvResult result = cvService.findTemplate(cvTemplate);
                assertNotNull(result, "Template not found in image: " + cvTemplate.getFilenamePrefix());
                assertEquals(cvTemplate.getTopLeft().getX(), result.getTopLeft().getX());
                assertEquals(cvTemplate.getTopLeft().getY(), result.getTopLeft().getY());
            }catch (Exception e) {
                fail("Template not found in image: " + cvTemplate.getFilenamePrefix());
            }
        }
    }*/

}
