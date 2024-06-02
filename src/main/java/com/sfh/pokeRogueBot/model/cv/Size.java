package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class Size {
    private final int width;
    private final int height;

    public Size(int width, int height) {
        this.width = width;
        this.height = height;
    }
}
