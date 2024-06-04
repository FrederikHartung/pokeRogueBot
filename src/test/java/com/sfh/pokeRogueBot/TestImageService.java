package com.sfh.pokeRogueBot;

import com.sfh.pokeRogueBot.model.exception.ImageValidationException;
import com.sfh.pokeRogueBot.service.BrowserImageService;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

public class TestImageService {
    private TestImageService (){
    }

    public static BufferedImage getCanvas(String path) throws IOException, ImageValidationException {
        File fileStage = new File(path);
        BufferedImage image = ImageIO.read(fileStage);
        BrowserImageService.validateImage(image);

        return image;
    }

    public static BufferedImage getTemplate(String path) throws IOException, ImageValidationException {
        File fileTemplate = new File(path);
        BufferedImage image = ImageIO.read(fileTemplate);
        BrowserImageService.validateTemplate(image);

        return image;
    }
}
