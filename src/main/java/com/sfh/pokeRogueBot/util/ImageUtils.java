package com.sfh.pokeRogueBot.util;

import com.sfh.pokeRogueBot.model.cv.ParentSize;
import lombok.extern.slf4j.Slf4j;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;

@Slf4j
public class ImageUtils {

    private ImageUtils() {
    }

    public static BufferedImage scaleImage(String filenamePrefix, BufferedImage canvas, ParentSize parentSize){
        double scaleFactorX = (double) canvas.getWidth() / parentSize.getWidth();
        double scaleFactorY = (double) canvas.getHeight() / parentSize.getHeight();

        log.debug(filenamePrefix + ", scaleFactorX: " + scaleFactorX + " scaleFactorY: " + scaleFactorY);
        return scaleImage(canvas, scaleFactorX, scaleFactorY);
    }

    public static BufferedImage scaleImage(BufferedImage originalImage, double scaleFactorX, double scaleFactorY) {
        int newWidth = (int) (originalImage.getWidth() * scaleFactorX);
        int newHeight = (int) (originalImage.getHeight() * scaleFactorY);

        BufferedImage scaledImage = new BufferedImage(newWidth, newHeight, originalImage.getType());
        Graphics2D g2d = scaledImage.createGraphics();

        AffineTransform affineTransform = AffineTransform.getScaleInstance(scaleFactorX, scaleFactorY);
        g2d.drawRenderedImage(originalImage, affineTransform);
        g2d.dispose();

        return scaledImage;
    }

}
