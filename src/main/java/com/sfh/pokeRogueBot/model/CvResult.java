package com.sfh.pokeRogueBot.model;

import lombok.Getter;

@Getter
public class CvResult {

    private final int x;
    private final int y;
    private final int middlePointX;
    private final int middlePointY;
    private final int widthScreenshot;
    private final int heightScreenshot;
    private final int widthTemplate;
    private final int heightTemplate;

    public CvResult(int x, int y, int middlePointX, int middlePointY, int widthScreenshot, int heightScreenshot, int widthTemplate, int heightTemplate) {
        this.x = x;
        this.y = y;
        this.middlePointX = middlePointX;
        this.middlePointY = middlePointY;
        this.widthScreenshot = widthScreenshot;
        this.heightScreenshot = heightScreenshot;
        this.widthTemplate = widthTemplate;
        this.heightTemplate = heightTemplate;
    }

    @Override
    public String toString() {
        return "CvResult{" +
                "x=" + x +
                ", y=" + y +
                ", middlePointX=" + middlePointX +
                ", middlePointY=" + middlePointY +
                ", widthScreenshot=" + widthScreenshot +
                ", heightScreenshot=" + heightScreenshot +
                ", widthTemplate=" + widthTemplate +
                ", heightTemplate=" + heightTemplate
                + '}';
    }
}
