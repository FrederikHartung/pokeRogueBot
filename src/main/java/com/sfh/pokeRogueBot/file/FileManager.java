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
        File folder = new File(getScreenshotTempDirPath());
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
        String filePath = getFilePath(fileNamePrefix);

        try {
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, new File(filePath));
            fileIndex++;
            log.info("Screenshot persisted: " + filePath);
        } catch (Exception e) {
            log.error("Error while saving screenshot to: " + filePath, e);
        }
    }

    /**
     * Returns the directory path for saving temporary screenshots.
     * @return the directory path plus a file separator for the corresponding OS
     */
    public String getScreenshotTempDirPath() {
        return DIR_TEMP + File.separator;
    }

    /**
     * Returns the file path for the given file name prefix for saving screenshots.
     * @param fileNamePrefix a custom filename prefix
     * @return the file path where the screenshot will be saved
     */
    public String getFilePath(String fileNamePrefix) {
        return DIR_TEMP + File.separator + fileIndex + "_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION;
    }
}
