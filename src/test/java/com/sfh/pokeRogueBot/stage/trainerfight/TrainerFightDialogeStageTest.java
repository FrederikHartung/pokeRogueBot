package com.sfh.pokeRogueBot.stage.trainerfight;

import com.sfh.pokeRogueBot.TestImageService;
import com.sfh.pokeRogueBot.config.SingletonBeanConfig;
import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import com.sfh.pokeRogueBot.service.CvService;
import com.sfh.pokeRogueBot.service.ImageService;
import com.sfh.pokeRogueBot.service.OpenCvService;
import com.sfh.pokeRogueBot.stage.fight.trainer.TrainerFightDialogeStage;
import com.sfh.pokeRogueBot.stage.fight.trainer.TrainerFightStartStage;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.TemplateUtils;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class TrainerFightDialogeStageTest {

    SingletonBeanConfig singletonBeanConfig = new SingletonBeanConfig();

    OpenCvClient openCvClient = new OpenCvClient(
            singletonBeanConfig.getCvProcessingAlgorithm(),
            new CvResultFilehandler(),
            5);
    CvService cvService = new OpenCvService(mock(ImageService.class), openCvClient);
    TrainerFightDialogeStage trainerFightDialogeStage = new TrainerFightDialogeStage();

    @BeforeAll
    static void setup(){
        TempFileManager tempFileManager = new TempFileManager();
        tempFileManager.deleteTempData();
    }

    @Test
    void find_all_templates(){
        boolean persistResults = true;
        List<CvTemplate> cvTemplates = TemplateUtils.getCvTemplatesFromStage(trainerFightDialogeStage);

        for (CvTemplate cvTemplate : cvTemplates) {
            cvTemplate.setPersistResultOnSuccess(persistResults);
            cvTemplate.setPersistResultOnError(persistResults);
            try{
                BufferedImage canvas = TestImageService.getCanvas(trainerFightDialogeStage.getTemplatePath());
                BufferedImage template = TestImageService.getTemplate(cvTemplate.getTemplatePath());
                assertNotNull(cvService.findTemplate(cvTemplate, canvas, template));
            }
            catch (Exception e) {
                fail("Error checking template: " + cvTemplate.getFilenamePrefix(), e);
            }
        }
    }

}