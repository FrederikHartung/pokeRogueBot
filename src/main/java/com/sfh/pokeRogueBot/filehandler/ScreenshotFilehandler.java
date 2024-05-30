package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.browser.ScreenshotClient;
import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.io.File;

@Slf4j
public class ScreenshotFilehandler {

    private ScreenshotFilehandler(){

    }

    public static void persistScreenshot(File scrFile, String fileNamePrefix) {
        String filePath = Constants.DIR_TEMP + TempFileManager.fileIndex + "_screenshot_" + fileNamePrefix + Constants.SCREENSHOT_FILE_EXTENSION;

        try {
            FileUtils.moveFile(scrFile, new File(filePath));
            TempFileManager.fileIndex++;
            log.info("Screenshot persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while saving screenshot to: " + filePath, e);
        }
    }
}
