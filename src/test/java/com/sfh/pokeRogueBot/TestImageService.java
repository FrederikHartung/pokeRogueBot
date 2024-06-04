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
        image = BrowserImageService.removeAlphaChannel(image);
        BrowserImageService.validateImage(image, path);

        return image;
    }

    public static BufferedImage getTemplate(String path) throws IOException, ImageValidationException {
        File fileTemplate = new File(path);
        BufferedImage image = ImageIO.read(fileTemplate);
        image = BrowserImageService.removeAlphaChannel(image);
        BrowserImageService.validateTemplate(image, path);

        return image;
    }
}
