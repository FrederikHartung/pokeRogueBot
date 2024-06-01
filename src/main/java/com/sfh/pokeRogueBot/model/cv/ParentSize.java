package com.sfh.pokeRogueBot.model.cv;

import lombok.Getter;

@Getter
public class ParentSize {
    private final int width;
    private final int height;

    public ParentSize(int width, int height) {
        this.width = width;
        this.height = height;
    }
}
