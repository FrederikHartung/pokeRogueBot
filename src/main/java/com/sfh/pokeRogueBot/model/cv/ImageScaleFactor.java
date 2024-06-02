package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class ImageScaleFactor {
    private final double factorX;
    private final double factorY;

    public ImageScaleFactor(double factorX, double factorY) {
        this.factorX = factorX;
        this.factorY = factorY;
    }
}
