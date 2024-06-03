package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.cv.OpenCvClient;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.support.RetryTemplateBuilder;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;

@Slf4j
@Component
public class OpenCvService implements CvService {

    private final RetryTemplate retryTemplateForFindingTemplates;
    private final ImageService imageService;
    private final OpenCvClient cvClient;

    public OpenCvService(
            @Value("${cv.retry.maxAttemptsForSearchingTemplates}") int maxAttemptsForSearchingTemplates,
            @Value("${cv.retry.backoffPeriodForSearchingTemplates}") long backoffPeriodForSearchingTemplates, ImageService imageService, OpenCvClient cvClient) {
        this.imageService = imageService;
        this.cvClient = cvClient;

        this.retryTemplateForFindingTemplates = new RetryTemplateBuilder()
                .maxAttempts(maxAttemptsForSearchingTemplates)
                .fixedBackoff(backoffPeriodForSearchingTemplates)
                .retryOn(TemplateNotFoundException.class)
                .build();
    }

    @Override
    public boolean isTemplateVisible(CvTemplate cvTemplate) throws IOException {
        if (null != findTemplate(cvTemplate)) {
            log.debug("visibility check with image: Template visible: " + cvTemplate.getFilenamePrefix());
            return true;
        }

        throw new TemplateNotFoundException("Template not found in image: " + cvTemplate.getFilenamePrefix());
    }

    @Override
    public CvResult findTemplate(CvTemplate cvTemplate) throws IOException {
        return retryTemplateForFindingTemplates.execute(context -> {
            BufferedImage canvasImg = imageService.takeScreenshot(cvTemplate.getFilenamePrefix());
            BufferedImage templateImg = imageService.loadTemplate(cvTemplate.getTemplatePath());

            return cvClient.findTemplateInBufferedImage(canvasImg, templateImg, cvTemplate);
        });
    }
}
