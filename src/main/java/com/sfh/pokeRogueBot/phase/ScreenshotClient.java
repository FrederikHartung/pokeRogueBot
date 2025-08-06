package com.sfh.pokeRogueBot.phase;

public interface ScreenshotClient {
    void takeTempScreenshot(String prefix);

    void persistScreenshot(String prefix);
}
