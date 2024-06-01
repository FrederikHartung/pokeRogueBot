package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.ImageClient;
import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.cv.Point;
import com.sfh.pokeRogueBot.model.cv.ScaleFactor;
import com.sfh.pokeRogueBot.model.cv.Size;
import com.sfh.pokeRogueBot.model.exception.ImageValidationException;
import com.sfh.pokeRogueBot.util.ScalingUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

@Slf4j
@Component
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

        ScaleFactor scaleFactor = ScalingUtils.calcScaleFactor(canvas);

        BufferedImage scaledImage = scaleImage(canvas, scaleFactor.getScaleFactorWidth(), scaleFactor.getScaleFactorHeight());
        scaledImage = removeAlphaChannel(scaledImage);

        validateImage(scaledImage);

        //todo: remove logging methode
        log.debug(filenamePrefix + ", scaleFactorX: " + scaleFactor.getScaleFactorWidth() + " scaleFactorY: " + scaleFactor.getScaleFactorHeight());
        return scaledImage;
    }

    private void validateImage(BufferedImage image) throws ImageValidationException {
        if (image.getWidth() != Constants.STANDARDISED_CANVAS_WIDTH || image.getHeight() != Constants.STANDARDISED_CANVAS_HEIGHT) {
            throw new ImageValidationException("Image has wrong dimensions: " + image.getWidth() + "x" + image.getHeight());
        }

        if (image.getType() != BufferedImage.TYPE_3BYTE_BGR) {
            throw new ImageValidationException("Image has wrong color type: " + checkColorType(image));
        }
    }

    /**
     * Loads a template from the given path.
     * Don't need to scale, because all templates are based on the same canvas size.
     */
    @Override
    public BufferedImage loadTemplate(String path) throws ImageValidationException, IOException {
        File file = new File(path);
        BufferedImage template = ImageIO.read(file);
        template = removeAlphaChannel(template);

        validateTemplate(template);

        return template;
    }

    @Override
    public BufferedImage getSubImage(BufferedImage image, Point topLeft, Size size) {
        return image.getSubimage(topLeft.getX(), topLeft.getY(), size.getWidth(), size.getHeight());
    }

    private void validateTemplate(BufferedImage image) throws ImageValidationException {
        if (image.getType() != BufferedImage.TYPE_3BYTE_BGR) {
            throw new ImageValidationException("Template has wrong color type: " + checkColorType(image));
        }
    }


    private BufferedImage scaleImage(BufferedImage originalImage, double scaleFactorX, double scaleFactorY) {
        //round to next full pixel
        int newWidth = (int) Math.round(originalImage.getWidth() / scaleFactorX);
        int newHeight = (int) Math.round(originalImage.getHeight() / scaleFactorY);

        BufferedImage scaledImage = new BufferedImage(newWidth, newHeight, originalImage.getType());
        Graphics2D g2d = scaledImage.createGraphics();

        AffineTransform affineTransform = AffineTransform.getScaleInstance(scaleFactorX, scaleFactorY);
        g2d.drawRenderedImage(originalImage, affineTransform);
        g2d.dispose();

        return scaledImage;
    }

    private String checkColorType(BufferedImage image) {
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

    private BufferedImage removeAlphaChannel(BufferedImage image) {
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
