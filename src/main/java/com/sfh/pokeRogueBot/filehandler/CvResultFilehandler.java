package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Mat;
import org.opencv.imgcodecs.Imgcodecs;

@Slf4j
public class CvResultFilehandler {
    private CvResultFilehandler() {
    }

    public static void persist(String fileNamePrefix, Mat image) {
        String fileName = Constants.DIR_TEMP + TempFileManager.fileIndex + "_cv_" + fileNamePrefix + ".png";
        try {
            Imgcodecs.imwrite(fileName, image);
            TempFileManager.fileIndex++;
            log.debug("cvResult persisted: " + fileName);
        } catch (Exception e) {
            log.error("Error while persisting cvResult: " + fileName, e);
        }
    }
}
