package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;

import java.nio.file.Files;
import java.nio.file.Paths;

@Slf4j
public class HtmlFilehandler {

    private HtmlFilehandler() {
        throw new IllegalStateException("Utility class");
    }

    public static void persistPageBody(String fileNamePrefix, String bodyText) {
        String filePath = Constants.DIR_TEMP + TempFileManager.fileIndex + "_body_" + fileNamePrefix + ".html";

        try {
            Files.write(Paths.get(filePath), bodyText.getBytes());
            TempFileManager.fileIndex++;
            log.debug("Page body persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while persisting page body: " + filePath, e);
        }
    }
}
