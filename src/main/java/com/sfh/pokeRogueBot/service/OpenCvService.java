package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;

@Slf4j
@Component
public class OpenCvService implements CvService {

    private static final String ERROR_WHILE_SEARCHING_FOR_OBJECT = "Error while searching for object: ";
    private static final String CHECKING_VISIBILITY = "visibility check with image: Template visible: ";
    private static final String NOT_FOUND = "Template not found in image: ";
    private final ImageService imageService;
    private final OpenCvClient cvClient;

    public OpenCvService(ImageService imageService, OpenCvClient cvClient) {
        this.imageService = imageService;
        this.cvClient = cvClient;
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate) throws TemplateNotFoundException {
        if (null != findTemplate(cvTemplate)) {
            log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
            return true;
        }

        throw new TemplateNotFoundException(NOT_FOUND + cvTemplate.getFilenamePrefix());
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg) throws TemplateNotFoundException {
        if (null != findTemplate(cvTemplate, canvasImg)) {
            log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
            return true;
        }

        throw new TemplateNotFoundException(NOT_FOUND + cvTemplate.getFilenamePrefix());
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg) throws TemplateNotFoundException {
        if (null != findTemplate(cvTemplate, canvasImg, templateImg)) {
            log.debug(CHECKING_VISIBILITY + cvTemplate.getFilenamePrefix());
            return true;
        }

        throw new TemplateNotFoundException(NOT_FOUND + cvTemplate.getFilenamePrefix());
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
            return cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);
        }
        catch (Exception e) {
            log.error(ERROR_WHILE_SEARCHING_FOR_OBJECT + e.getMessage(), e);
            return null;
        }
    }
}
