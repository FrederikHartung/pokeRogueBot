package com.sfh.pokeRogueBot.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class OcrResult {
    private final String text;
    private final String screenshotPath;
/*    private final int x;
    private final int y;
    private final int width;
    private final int height;*/
}
