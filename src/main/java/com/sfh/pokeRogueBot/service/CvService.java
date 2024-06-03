package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.template.CvTemplate;

import java.io.IOException;

public interface CvService {

    boolean isTemplateVisible(CvTemplate cvTemplate) throws IOException;

    CvResult findTemplate(CvTemplate cvTemplate) throws IOException;
}
