package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.exception.TemplateNotFoundException;
import com.sfh.pokeRogueBot.template.CvTemplate;

import javax.annotation.Nullable;
import java.awt.image.BufferedImage;
import java.io.IOException;

public interface CvService {

    boolean isTemplateVisible(CvTemplate cvTemplate) throws IOException;

    boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg) throws TemplateNotFoundException;

    boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg) throws TemplateNotFoundException;

    @Nullable
    CvResult findTemplate(CvTemplate cvTemplate);

    CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg);

    CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg);
}
