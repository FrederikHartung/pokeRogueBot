package com.sfh.pokeRogueBot.util;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.cv.ScaleFactor;
import com.sfh.pokeRogueBot.model.cv.Size;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.WebElement;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

@Deprecated
public class ScalingUtils {
    private ScalingUtils() {
    }

    public static ScaleFactor calcScaleFactor(BufferedImage canvas){
        double scaleFactorX = (double) canvas.getWidth() / Constants.STANDARDISED_CANVAS_WIDTH;
        double scaleFactorY = (double) canvas.getHeight() / Constants.STANDARDISED_CANVAS_HEIGHT;
        return new ScaleFactor(scaleFactorX, scaleFactorY);
    }

    public static ScaleFactor calcScaleFactor(Size size){
        double scaleFactorX = (double)size.getWidth() / Constants.STANDARDISED_CANVAS_WIDTH;
        double scaleFactorY = (double)size.getHeight() / Constants.STANDARDISED_CANVAS_HEIGHT;
        return new ScaleFactor(scaleFactorX, scaleFactorY);
    }
}
