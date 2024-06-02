package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class ScaleFactor {

    private final double scaleFactorWidth;
    private final double scaleFactorHeight;

    public ScaleFactor(double scaleFactorWidth, double scaleFactorHeight) {
        this.scaleFactorWidth = scaleFactorWidth;
        this.scaleFactorHeight = scaleFactorHeight;
    }
}
