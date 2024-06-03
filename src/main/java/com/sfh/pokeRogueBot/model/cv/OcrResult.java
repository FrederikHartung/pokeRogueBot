package com.sfh.pokeRogueBot.model.cv;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class OcrResult {
    private final String foundText;
    private final double matchingConfidence;
}
