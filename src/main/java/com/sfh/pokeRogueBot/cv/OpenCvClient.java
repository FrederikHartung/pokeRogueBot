package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvProcessingAlgorithm;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.enums.CvFilterType;
import com.sfh.pokeRogueBot.template.CvTemplate;
import com.sfh.pokeRogueBot.template.Template;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class OpenCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    private final CvProcessingAlgorithm algorithm;

    /*
     CvProcessingAlgorithm is configered in SingletonBeanConfig
     */
    public OpenCvClient(CvProcessingAlgorithm algorithm) {
        this.algorithm = algorithm;
    }

    public CvResult findTemplateInFile(String pathToBigImage, CvTemplate template) {
        List<CvResult> results = findTemplatesInFile(pathToBigImage, template, 1);
        return results.isEmpty() ? null : results.get(0);
    }

    public CvResult findTemplateInBufferedImage(BufferedImage bufferedImage, CvTemplate template) throws IOException {
        List<CvResult> results = findTemplatesInBufferedImage(bufferedImage, template, 1);
        return results.isEmpty() ? null : results.get(0);
    }

    public List<CvResult> findTemplatesInFile(String pathToBigImage, CvTemplate template, int bestResults) {
        Mat bigImage = Imgcodecs.imread(pathToBigImage);
        Mat smallImage = Imgcodecs.imread(template.getTemplatePath());
        return findMat(bigImage, smallImage, template, bestResults);
    }

    public List<CvResult> findTemplatesInBufferedImage(BufferedImage screenshot, CvTemplate template, int bestResults) throws IOException {
        Mat bigImage = bufferedImageToMat(screenshot);
        Mat smallImage = Imgcodecs.imread(template.getTemplatePath());
        return findMat(bigImage, smallImage, template, bestResults);
    }

    private List<CvResult> findMat(Mat bigImage, Mat smallImage, CvTemplate template, int bestResults) {
        try {
            // Berechne die Skalierungsfaktoren
            double scaleX = (double) bigImage.cols() / template.getParentWidth();
            double scaleY = (double) bigImage.rows() / template.getParentHeight();
            log.debug(template.getFilenamePrefix() + ": scaleX: " + scaleX + ", scaleY: " + scaleY);

            // Skaliere das Template
            Mat scaledTemplate = new Mat();
            Imgproc.resize(smallImage, scaledTemplate, new Size(smallImage.cols() * scaleX, smallImage.rows() * scaleY));

            // Ergebnis-Matrix initialisieren
            int resultCols = bigImage.cols() - scaledTemplate.cols() + 1;
            int resultRows = bigImage.rows() - scaledTemplate.rows() + 1;
            Mat result = new Mat(resultRows, resultCols, CvType.CV_32FC1);

            return applyImgProc(algorithm, bigImage, scaledTemplate, result, template, bestResults);

        } catch (Exception e) {
            log.error("Error while searching for object: " + e.getMessage(), e);
        }

        return Collections.emptyList();
    }

    private List<CvResult> applyImgProc(CvProcessingAlgorithm algorithm, Mat bigImage, Mat smallImage, Mat result, Template template, int bestResults) {
        List<CvResult> results = new ArrayList<>();
        Imgproc.matchTemplate(bigImage, smallImage, result, algorithm.getAlgorithm());
        Core.normalize(result, result, 0, 1, Core.NORM_MINMAX, -1, new Mat());

        for (int i = 0; i < bestResults; i++) {
            Core.MinMaxLocResult mmr = Core.minMaxLoc(result);
            boolean maxValueIsToLow = (algorithm.getFilterType() == CvFilterType.HIGHEST_Result) && (mmr.maxVal < algorithm.getThreshHold());
            boolean minValueIsToHigh = (algorithm.getFilterType() == CvFilterType.LOWEST_Result) && (mmr.minVal > algorithm.getThreshHold());
            if(maxValueIsToLow || minValueIsToHigh){
                break;
            }

            log.debug(template.getFilenamePrefix() + ": min: " + mmr.minVal + ", max: " + mmr.maxVal);
            Point matchLoc = algorithm.getFilterType() == CvFilterType.HIGHEST_Result ? mmr.maxLoc : mmr.minLoc;

            // Bereich um den gefundenen Punkt vergrößern, um Wiederholungen zu vermeiden
            int floodFillWidth = smallImage.cols() / 2;
            int floodFillHeight = smallImage.rows() / 2;
            Rect floodRect = new Rect(
                    (int) Math.max(matchLoc.x - (floodFillWidth / 2d), 0),
                    (int) Math.max(matchLoc.y - (floodFillHeight / 2d), 0),
                    floodFillWidth,
                    floodFillHeight
            );
            Imgproc.rectangle(result, floodRect.tl(), floodRect.br(), new Scalar(1), Core.FILLED);

            if(template.persistResultWhenFindingTemplate()){
                // Rechteck um das gefundene Objekt zeichnen
                Imgproc.rectangle(bigImage, matchLoc, new Point(matchLoc.x + smallImage.cols(), matchLoc.y + smallImage.rows()), new Scalar(0, 255, 0), 2);
            }

            // Ergebnis hinzufügen
            int xMiddle = (int)(matchLoc.x + (smallImage.cols() / 2d));
            int yMiddle = (int)(matchLoc.y + (smallImage.rows() / 2d));
            CvResult cvResult = new CvResult(
                    (int) matchLoc.x,
                    (int) matchLoc.y,
                    xMiddle,
                    yMiddle,
                    bigImage.cols(),
                    bigImage.rows(),
                    smallImage.cols(),
                    smallImage.rows()
            );
            log.debug(template.getFilenamePrefix() + ": Found object at: " + cvResult);

            results.add(cvResult);
        }

        if(template.persistResultWhenFindingTemplate() && !results.isEmpty()){
            CvResultFilehandler.persist(template.getFilenamePrefix(), bigImage);
        }

        if(results.isEmpty()){
            CvResultFilehandler.persist(template.getFilenamePrefix(), bigImage);
        }

        return results;
    }

    private Mat bufferedImageToMat(BufferedImage bufferedImage) throws IOException {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, Constants.IMAGE_IO_FILE_EXTENSION, byteArrayOutputStream);  // Specify the format
        byteArrayOutputStream.flush();
        byte[] byteArray = byteArrayOutputStream.toByteArray();
        byteArrayOutputStream.close();

        return Imgcodecs.imdecode(new MatOfByte(byteArray), Imgcodecs.IMREAD_UNCHANGED);
    }
}
