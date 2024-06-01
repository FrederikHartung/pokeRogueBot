package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class OcrPosition {
    private final Point topLeft;
    private final Size size;

    private final ParentSize parentSize;

    public OcrPosition(Point topLeft, Size size, ParentSize parentSize) {
        this.topLeft = topLeft;
        this.size = size;
        this.parentSize = parentSize;
    }
}
