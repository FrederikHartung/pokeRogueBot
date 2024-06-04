package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class CvResult {

    private final Point topLeft;
    private final Point middle;
    private final Size templateSize;

    public CvResult(Point topLeft, Point middle, Size templateSize) {
        this.topLeft = topLeft;
        this.middle = middle;
        this.templateSize = templateSize;
    }


    @Override
    public String toString() {
        return "CvResult{" +
                "topLeft = x: " + topLeft.getX() + " y: " + topLeft.getY() +
                ", middle = x: " + middle.getX() + " y: " + middle.getY() +
                ", templateSize = width: " + templateSize + " height: " + templateSize +
                '}';
    }
}
