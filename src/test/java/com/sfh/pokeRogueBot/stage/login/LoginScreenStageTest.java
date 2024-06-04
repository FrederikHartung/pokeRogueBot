package com.sfh.pokeRogueBot.stage.login;

import com.sfh.pokeRogueBot.TestImageService;
import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import com.sfh.pokeRogueBot.template.TemplatePathValidator;
import com.sfh.pokeRogueBot.template.TemplateUtils;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.awt.image.BufferedImage;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.mock;

@SpringBootTest
class LoginScreenStageTest {

    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();
    TemplatePathValidator validator = new TemplatePathValidator();
    LoginScreenStage loginScreenStage = new LoginScreenStage(validator);
    OpenCvClient openCvClient = new OpenCvClient(
            singletonBeanConfig.getCvProcessingAlgorithm(),
            mock(CvResultFilehandler.class),
            5);
    CvService cvService = new OpenCvService(mock(ImageService.class), openCvClient);

    @Test
    void find_all_templates(){
        Template[] templates = loginScreenStage.getTemplatesToValidateStage();
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplates(templates);

        for (CvTemplate cvTemplate : cvTemplates) {
            try{
                BufferedImage canvas = TestImageService.getCanvas(loginScreenStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNotNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Template not found in image: " + cvTemplate.getFilenamePrefix());
            }
        }
    }
}
