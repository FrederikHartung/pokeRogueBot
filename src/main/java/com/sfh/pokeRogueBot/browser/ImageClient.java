package com.sfh.pokeRogueBot.browser;

import java.awt.image.BufferedImage;
import java.io.IOException;

public interface ImageClient {

    BufferedImage takeScreenshotFromCanvas() throws IOException;
}
