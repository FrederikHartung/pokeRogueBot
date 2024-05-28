package com.sfh.pokeRogueBot.service;

import com.sfh.pokeRogueBot.browser.ScreenshotClient;
import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;

@Component
@Slf4j
public class ScreenshotService {

    private final ScreenshotClient screenshotClient;
    private int lastScreenshotNumber = 0;

    public ScreenshotService(ScreenshotClient screenshotClient) {
        this.screenshotClient = screenshotClient;
    }

    public void deleteAllOldScreenshots(){
        File folder = new File(Constants.SCREENSHOTS_TEMP_DIR);
        File[] files = folder.listFiles();
        if(files == null){
            return;
        }

        for(File file : files){
            if(null == file){
                continue;
            }

            if(file.isFile()){
                try{
                    Files.deleteIfExists(file.toPath());
                } catch (Exception e){
                    log.error("Could not delete file: " + file.getName());
                }
            }
        }
    }

    public String takeScreenshot(String screenshotPrefix){
        String pathToSaveTo = Constants.SCREENSHOTS_TEMP_DIR + screenshotPrefix + "_" + lastScreenshotNumber + Constants.SCREENSHOT_FILE_EXTENSION;
        screenshotClient.takeScreenshot(pathToSaveTo);
        lastScreenshotNumber++;
        return pathToSaveTo;
    }
}
