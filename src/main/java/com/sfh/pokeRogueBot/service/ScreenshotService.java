package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.ScreenshotClient;
import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ScreenshotService {

    private final ScreenshotClient screenshotClient;
    private int lastScreenshotNumber = 0;
    private String lastScreenshotPath;

    public ScreenshotService(ScreenshotClient screenshotClient) {
        this.screenshotClient = screenshotClient;
    }

    public String takeScreenshot(String screenshotPrefix){
        String pathToSaveTo = Constants.SCREENSHOTS_TEMP_DIR + screenshotPrefix + "_" + lastScreenshotNumber + Constants.SCREENSHOT_FILE_EXTENSION;
        screenshotClient.takeScreenshot(pathToSaveTo);
        lastScreenshotNumber++;
        lastScreenshotPath = pathToSaveTo;
        return pathToSaveTo;
    }

    public String getLastScreenshotPath() {
        return lastScreenshotPath;
    }
}
