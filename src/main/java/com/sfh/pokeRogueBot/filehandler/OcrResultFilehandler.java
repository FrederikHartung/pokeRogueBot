package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;

import java.nio.file.Files;
import java.nio.file.Paths;

@Slf4j
public class OcrResultFilehandler {
    private OcrResultFilehandler() {
    }

    public static void persist(String fileNamePrefix, String text) {
        String filePath = Constants.DIR_TEMP + TempFileManager.fileIndex + "_ocr_" + fileNamePrefix + ".txt";

        try {
            Files.write(Paths.get(filePath), text.getBytes());
            TempFileManager.fileIndex++;
            log.debug("Cv result persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while persisting cv result: " + filePath, e);
        }
    }
}
