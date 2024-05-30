package com.sfh.pokeRogueBot.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CvResult {
    private int x;
    private int middlePointX;
    private int y;
    private int middlePointY;
    private int width;
    private int height;

    @Override
    public String toString() {
        return "CvResult{" +
                "x=" + x +
                ", middlePointX=" + middlePointX +
                ", y=" + y +
                ", middlePointY=" + middlePointY +
                ", width=" + width +
                ", height=" + height +
                '}';
    }
}
