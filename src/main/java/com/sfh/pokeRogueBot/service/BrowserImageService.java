package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.ImageClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.exception.ImageValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.IOException;

@Slf4j
@Service
public class BrowserImageService implements ImageService {

    private final ImageClient imageClient;

    public BrowserImageService(ImageClient imageClient) {
        this.imageClient = imageClient;
    }

    /**
     * Takes a screenshot from the canvas and scales it to the standardised canvas size.
     * The canvas size can change depending on the screen size or resolution.
     */
    @Override
    public BufferedImage takeScreenshot(String filenamePrefix) throws ImageValidationException, IOException {
        BufferedImage canvas = imageClient.takeScreenshotFromCanvas();

        BufferedImage scaledImage = scaleImage(canvas);
        scaledImage = removeAlphaChannel(scaledImage);

        validateImage(scaledImage, filenamePrefix);

        return scaledImage;
    }

    public static void validateImage(BufferedImage image, String filenamePrefix) throws ImageValidationException {
        if (image.getWidth() != Constants.STANDARDISED_CANVAS_WIDTH || image.getHeight() != Constants.STANDARDISED_CANVAS_HEIGHT) {
            throw new ImageValidationException("Image has wrong dimensions: " + image.getWidth() + "x" + image.getHeight()
                    + ", expected: " + Constants.STANDARDISED_CANVAS_WIDTH + "x" + Constants.STANDARDISED_CANVAS_HEIGHT);
        }

        if (image.getType() != BufferedImage.TYPE_3BYTE_BGR) {
            throw new ImageValidationException("Image has wrong color type: " + checkColorType(image) + ", filenamePrefix: " + filenamePrefix);
        }
    }

    private BufferedImage scaleImage(BufferedImage originalImage) {
        int newWidth = Constants.STANDARDISED_CANVAS_WIDTH;
        int newHeight = Constants.STANDARDISED_CANVAS_HEIGHT;

        BufferedImage scaledImage = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_3BYTE_BGR);
        Graphics2D g2d = scaledImage.createGraphics();

        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);


        double scaleFactorX = newWidth / (double) originalImage.getWidth();
        double scaleFactorY = newHeight / (double) originalImage.getHeight();

        AffineTransform affineTransform = AffineTransform.getScaleInstance(scaleFactorX, scaleFactorY);
        g2d.drawRenderedImage(originalImage, affineTransform);
        g2d.dispose();

        return scaledImage;
    }

    private static String checkColorType(BufferedImage image) {
        switch (image.getType()) {
            case BufferedImage.TYPE_3BYTE_BGR:
                return "TYPE_3BYTE_BGR";
            case BufferedImage.TYPE_4BYTE_ABGR:
                return "TYPE_4BYTE_ABGR";
            case BufferedImage.TYPE_INT_RGB:
                return "TYPE_INT_RGB";
            case BufferedImage.TYPE_INT_ARGB:
                return "TYPE_INT_ARGB";
            case BufferedImage.TYPE_BYTE_GRAY:
                return "TYPE_BYTE_GRAY";
            case BufferedImage.TYPE_USHORT_GRAY:
                return "TYPE_USHORT_GRAY";
            default:
                return "Other type: " + image.getType();
        }
    }

    public static BufferedImage removeAlphaChannel(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_4BYTE_ABGR) {
            BufferedImage newImage = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_3BYTE_BGR);
            Graphics2D g = newImage.createGraphics();
            g.drawImage(image, 0, 0, null);
            g.dispose();
            return newImage;
        }
        return image;
    }
}
