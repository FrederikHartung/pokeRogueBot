package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.FixedPosiCvTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;

@Slf4j
@Service
public class OpenCvService implements CvService {

    private static final String ERROR_WHILE_SEARCHING_FOR_OBJECT = "Error while searching for object: ";
    private static final String CHECKING_VISIBILITY = "visibility check with image: Template visible: ";
    private final ImageService imageService;
    private final OpenCvClient cvClient;

    public OpenCvService(ImageService imageService, OpenCvClient cvClient) {
        this.imageService = imageService;
        this.cvClient = cvClient;
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate){
        try{
            if (null != findTemplate(cvTemplate)) {
                log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
                return true;
            }
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
        }
        return false;
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg) {
        try{
            if (null != findTemplate(cvTemplate, canvasImg)) {
                log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
                return true;
            }
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
        }
        return false;
    }

    @Override
    public boolean isTemplateVisible(FixedPosiCvTemplate fixedPosiCvTemplate, BufferedImage canvasImg) {
        try{
            BufferedImage subCanvasImg = imageService.getSubImage(canvasImg, fixedPosiCvTemplate.getSubImageTopLeft(), fixedPosiCvTemplate.getSubImageSize());
            if (null != findTemplate(fixedPosiCvTemplate, subCanvasImg)) {
                log.debug(CHECKING_VISIBILITY + fixedPosiCvTemplate.getFilenamePrefix());
                return true;
            }
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
        }
        return false;
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg) throws TemplateNotFoundException {
        try {
            if (null != findTemplate(cvTemplate, canvasImg, templateImg)) {
                log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
                return true;
            }
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
        }
        return false;
    }

    @Override
    public CvResult findTemplate(CvTemplate cvTemplate) {
        try{
            BufferedImage canvasImg = imageService.takeScreenshot(cvTemplate.getFilenamePrefix());
            BufferedImage templateImg = imageService.loadTemplate(cvTemplate.getTemplatePath());

            return cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
            return null;
        }
    }

    @Override
    public CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg) {
        try{
            BufferedImage templateImg = imageService.loadTemplate(cvTemplate.getTemplatePath());

            return cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
            return null;
        }
    }

    @Override
    public CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg) {
        try{
            if(cvTemplate instanceof FixedPosiCvTemplate fixedPosiCvTemplate){
                BufferedImage subCanvasImg = imageService.getSubImage(canvasImg, fixedPosiCvTemplate.getSubImageTopLeft(), fixedPosiCvTemplate.getSubImageSize());
                return cvClient.findTemplateInBufferedImage(subCanvasImg, templateImg, fixedPosiCvTemplate);
            }
            return cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
            return null;
        }
    }
}
