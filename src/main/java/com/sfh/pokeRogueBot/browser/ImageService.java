package com.sfh.pokeRogueBot.browser;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface ImageService {

    BufferedImage takeScreenshot() throws IOException;
}
