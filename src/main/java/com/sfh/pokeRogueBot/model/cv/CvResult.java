package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class CvResult {

    private final Point topLeft;
    private final Point middle;
    private final Size canvasSize;
    private final Size templateSize;
    private final double similarity;

    public CvResult(Point topLeft, Point middle, Size canvasSize, Size templateSize, double similarity) {
        this.topLeft = topLeft;
        this.middle = middle;
        this.canvasSize = canvasSize;
        this.templateSize = templateSize;
        this.similarity = similarity;
    }


    @Override
    public String toString() {
        return "CvResult{" +
                "topLeft = x: " + topLeft.getX() + " y: " + topLeft.getY() +
                ", middle = x: " + middle.getX() + " y: " + middle.getY() +
                ", canvasSize = width: " + canvasSize.getWidth() + " height: " + canvasSize.getHeight() +
                ", templateSize = width: " + templateSize + " height: " + templateSize +
                ", similarity = " + similarity +
                '}';
    }
}
