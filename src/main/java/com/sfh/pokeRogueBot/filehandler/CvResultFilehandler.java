package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Mat;
import org.opencv.imgcodecs.Imgcodecs;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;

@Slf4j
@Component
public class CvResultFilehandler {

    public void persist(String fileNamePrefix, Mat image) {
        String fileName = Constants.DIR_TEMP + TempFileManager.getFileIndex() + "_cv_" + fileNamePrefix + ".png";
        try {
            Imgcodecs.imwrite(fileName, image);
            TempFileManager.incrementFileIndex();
            log.debug("cvResult persisted: " + fileName);
        } catch (Exception e) {
            log.error("Error while persisting cvResult: " + fileName, e);
        }
    }

    public void persist(String fileNamePrefix, BufferedImage image) {
        String fileName = Constants.DIR_TEMP + TempFileManager.getFileIndex() + "_cv_" + fileNamePrefix + ".png";
        try {
            ImageIO.write(image, "png", new File(fileName));

            TempFileManager.incrementFileIndex();
            log.debug("cvResult persisted: " + fileName);
        } catch (Exception e) {
            log.error("Error while persisting cvResult: " + fileName, e);
        }
    }
}
