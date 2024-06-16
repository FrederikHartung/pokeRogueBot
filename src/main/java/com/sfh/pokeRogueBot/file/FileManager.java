package com.sfh.pokeRogueBot.file;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
@Slf4j
public class FileManager {

    public static final String IMAGE_IO_FILE_EXTENSION = "png";
    public static final String SCREENSHOT_FILE_EXTENSION = ".png";
    public static final String DIR_TEMP = Paths.get(".", "data", "temp").toString();
    private int fileIndex = 0;

    public void deleteTempData() {
        File folder = new File(DIR_TEMP);
        File[] files = folder.listFiles();
        if (files == null) {
            return;
        }

        for (File file : files) {
            if (null == file) {
                continue;
            }

            if (file.isFile()) {
                try {
                    Files.deleteIfExists(file.toPath());
                } catch (Exception e) {
                    log.error("Could not delete file: " + file.getName());
                }
            }
        }
    }

    public void persistBufferedImage(BufferedImage bufferedImage, String fileNamePrefix) {
        String filePath = DIR_TEMP + fileIndex + "_screenshot_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION;

        try {
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, new File(filePath));
            fileIndex++;
            log.info("Screenshot persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while saving screenshot to: " + filePath, e);
        }
    }
}
