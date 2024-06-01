package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class OcrPosition {
    private final Point topLeft;
    private final Size size;

    public OcrPosition(Point topLeft, Size size) {
        this.topLeft = topLeft;
        this.size = size;
    }
}
