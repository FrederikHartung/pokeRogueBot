package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.FixedPosiCvTemplate;

import javax.annotation.Nullable;
import java.awt.image.BufferedImage;

public interface CvService {

    boolean isTemplateVisible(CvTemplate cvTemplate);

    boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg);

    boolean isTemplateVisible(FixedPosiCvTemplate fixedPosiCvTemplate, BufferedImage canvasImg);

    boolean isTemplateVisible(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg);

    @Nullable
    CvResult findTemplate(CvTemplate cvTemplate);

    CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg);

    CvResult findTemplate(CvTemplate cvTemplate, BufferedImage canvasImg, BufferedImage templateImg);
}
