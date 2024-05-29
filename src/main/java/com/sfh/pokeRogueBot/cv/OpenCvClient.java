package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.model.CvResult;
import com.sfh.pokeRogueBot.template.Template;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class OpenCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    private int fileIndex = 0;

    public CvResult findObject(String pathToBigImage, Template template) {
        List<CvResult> results = findObjects(pathToBigImage, template, 1);
        return results.isEmpty() ? null : results.get(0);
    }

    public List<CvResult> findObjects(String pathToBigImage, Template template, int bestResults) {
        List<CvResult> results = new ArrayList<>();
        try {
            Mat bigImage = Imgcodecs.imread(pathToBigImage);
            Mat smallImage = Imgcodecs.imread(template.getTemplatePath());

            // Ergebnis-Matrix initialisieren
            int resultCols = bigImage.cols() - smallImage.cols() + 1;
            int resultRows = bigImage.rows() - smallImage.rows() + 1;
            Mat result = new Mat(resultRows, resultCols, CvType.CV_32FC1);

            // Template Matching durchführen
            Imgproc.matchTemplate(bigImage, smallImage, result, Imgproc.TM_SQDIFF);
            Core.normalize(result, result, 0, 1, Core.NORM_MINMAX, -1, new Mat());

            // Mehrfache beste Ergebnisse finden
            for (int i = 0; i < bestResults; i++) {
                Core.MinMaxLocResult mmr = Core.minMaxLoc(result);
                Point matchLoc = mmr.minLoc;

                // Bereich um den gefundenen Punkt vergrößern, um Wiederholungen zu vermeiden
                int floodFillWidth = smallImage.cols() / 2;
                int floodFillHeight = smallImage.rows() / 2;
                Rect floodRect = new Rect(
                        (int) Math.max(matchLoc.x - floodFillWidth / 2, 0),
                        (int) Math.max(matchLoc.y - floodFillHeight / 2, 0),
                        floodFillWidth,
                        floodFillHeight
                );
                Imgproc.rectangle(result, floodRect.tl(), floodRect.br(), new Scalar(1), Core.FILLED);


                // Rechteck um das gefundene Objekt zeichnen
                Imgproc.rectangle(bigImage, matchLoc, new Point(matchLoc.x + smallImage.cols(), matchLoc.y + smallImage.rows()), new Scalar(0, 255, 0), 2);

                // Ergebnis hinzufügen
                log.info("Found object at x: " + (int) matchLoc.x + ", y: " + (int) matchLoc.y + " with width: " + smallImage.cols() + ", height: " + smallImage.rows());
                results.add(new CvResult((int) matchLoc.x, (int) matchLoc.y, smallImage.cols(), smallImage.rows()));
            }

            // Bild mit den Rechtecken exportieren
            Imgcodecs.imwrite(Constants.DIR_CV_RESULTS_TEMP + fileIndex + "_" + template.getFilenamePrefix() + ".png", bigImage);
            fileIndex++;

        } catch (Exception e) {
            log.error("Error while searching for object: " + e.getMessage(), e);
        }
        return results;
    }

}
