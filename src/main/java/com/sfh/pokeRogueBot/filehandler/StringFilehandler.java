package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;

import java.nio.file.Files;
import java.nio.file.Paths;

@Slf4j
public class StringFilehandler {
    private StringFilehandler() {
    }

    public static void persist(String exportType, String fileNamePrefix, String text) {
        String filePath = Constants.DIR_TEMP + TempFileManager.fileIndex + "_" + exportType + "_" + fileNamePrefix + ".txt";

        try {
            Files.write(Paths.get(filePath), text.getBytes());
            TempFileManager.fileIndex++;
            log.debug(exportType + " persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while persisting " + exportType + ": " + filePath, e);
        }
    }
}
