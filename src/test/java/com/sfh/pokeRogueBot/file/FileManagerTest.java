package com.sfh.pokeRogueBot.file;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.internal.util.Platform.OS_NAME;

class FileManagerTest {

    boolean isWindows() {
        return OS_NAME.toLowerCase().contains("win");
    }

    boolean isMac() {
        return OS_NAME.toLowerCase().contains("mac");
    }

    FileManager fileManager = new FileManager();

    @Test
    void a_filepath_is_returned(){

        String fileNamePrefix = "test";
        String filePath = fileManager.getTempFilePath(fileNamePrefix);

        if(isWindows()){
            assertEquals(".\\data\\temp\\0_test.png", filePath);
        } else if(isMac()){
            assertEquals("./data/temp/0_test.png", filePath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

    @Test
    void a_directory_path_is_returned(){

        String screenshotTempDirPath = fileManager.getScreenshotTempDirPath();

        if(isWindows()){
            assertEquals(".\\data\\temp\\", screenshotTempDirPath);
        } else if(isMac()){
            assertEquals("./data/temp/", screenshotTempDirPath);
        } else {
            fail("Unknown OS, please add the OS to the test");
        }
    }

}