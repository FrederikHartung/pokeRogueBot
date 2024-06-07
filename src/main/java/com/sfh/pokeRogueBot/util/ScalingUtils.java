package com.sfh.pokeRogueBot.util;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.cv.ScaleFactor;
import com.sfh.pokeRogueBot.model.cv.Size;

import java.awt.image.BufferedImage;

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
