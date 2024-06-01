package com.sfh.pokeRogueBot.template;

public interface OcrTemplate extends Template{
    String[] getOcrTexts();
    double getMinConfidence();
}
