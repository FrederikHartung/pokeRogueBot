package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.model.exception.ImageValidationException;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface ImageService {

    BufferedImage takeScreenshot(String filenamePrefix) throws ImageValidationException, IOException;
}
