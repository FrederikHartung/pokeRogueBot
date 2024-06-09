package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.FightInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;

@Slf4j
@Service
public class FightInfoService {

    private final ImageService imageService;
    private final CvService cvService;

    public FightInfoService(ImageService imageService, CvService cvService) {
        this.imageService = imageService;
        this.cvService = cvService;
    }

    public FightInfo getFightInfo() {
        try{
            BufferedImage canvas = imageService.takeScreenshot("fight-info");

        }
        catch (Exception e){
            log.error("Error while getting fight info", e);
        }
        return null;
    }
}
