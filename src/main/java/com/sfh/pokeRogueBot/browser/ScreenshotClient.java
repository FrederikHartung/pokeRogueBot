package com.sfh.pokeRogueBot.browser;

public interface ScreenshotClient {
    void takeScreenshot(String path);
    void makeScreenshotAndMarkCalculatedClickPoint(int x, int y, String path);
}
