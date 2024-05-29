package com.sfh.pokeRogueBot.browser;

public interface ScreenshotClient {
    void takeScreenshot(String path);
    void makeScreenshotAndMarkClickPoint(int x, int y, String path);
}
