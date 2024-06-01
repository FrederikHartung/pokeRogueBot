package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.model.exception.ImageValidationException;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface ImageService {

    BufferedImage takeScreenshot(String filenamePrefix) throws ImageValidationException, IOException;

    BufferedImage loadTemplate(String path) throws ImageValidationException, IOException;

    BufferedImage getSubImage(BufferedImage image, Point topLeft, Size size);
}
