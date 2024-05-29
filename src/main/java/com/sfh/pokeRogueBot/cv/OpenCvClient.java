package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OpenCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    private int fileIndex = 0;

    public void findObject(String pathToBigImage, String pathToImageToSearch, String fileNamePrefix) {
        try {
            Mat bigImage = Imgcodecs.imread(pathToBigImage);
            Mat smallImage = Imgcodecs.imread(pathToImageToSearch);

            // Ergebnis-Matrix initialisieren
            int result_cols = bigImage.cols() - smallImage.cols() + 1;
            int result_rows = bigImage.rows() - smallImage.rows() + 1;
            Mat result = new Mat(result_rows, result_cols, CvType.CV_32FC1);

            // Template Matching durchführen
            int match_method = Imgproc.TM_CCOEFF_NORMED;
            Imgproc.matchTemplate(bigImage, smallImage, result, match_method);
            Imgproc.threshold(result, result, 0.5, 1.0, Imgproc.THRESH_TOZERO);
            Core.MinMaxLocResult mmr = Core.minMaxLoc(result);

            // Rechteck um das gefundene Objekt zeichnen
            Point matchLoc;
            if (match_method == Imgproc.TM_SQDIFF || match_method == Imgproc.TM_SQDIFF_NORMED) {
                matchLoc = mmr.minLoc;
            } else {
                matchLoc = mmr.maxLoc;
            }
            Imgproc.rectangle(bigImage, matchLoc, new Point(matchLoc.x + smallImage.cols(), matchLoc.y + smallImage.rows()), new Scalar(0, 255, 0), 2);

            // Bild mit dem Rechteck exportieren
            Imgcodecs.imwrite(Constants.CV_RESULTS_TEMP_DIR + fileIndex + "_" + fileNamePrefix + ".png", bigImage);
            fileIndex++;
        } catch (Exception e) {
            log.error("Error while searching for object: " + e.getMessage(), e);
        }
    }
}
