package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.config.Constants;
import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.StringFilehandler;
import com.sfh.pokeRogueBot.model.cv.CvProcessingAlgorithm;
import com.sfh.pokeRogueBot.model.cv.CvResult;
import com.sfh.pokeRogueBot.model.enums.CvFilterType;
import com.sfh.pokeRogueBot.template.CvTemplate;
import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Point;
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


    public CvResult findTemplateInBufferedImage(BufferedImage canvas, BufferedImage templateImage, CvTemplate template) throws IOException {
        List<CvResult> results = findMat(canvas, templateImage, template, 1);
        return results.isEmpty() ? null : results.get(0);
    }

    private List<CvResult> findMat(BufferedImage canvasImg, BufferedImage templateImg, CvTemplate template, int bestResults) throws IOException {
        Mat bigImage = bufferedImageToMat(canvasImg);
        Mat smallImage = bufferedImageToMat(templateImg);
        try {
            int resultCols = bigImage.cols() - smallImage.cols() + 1;
            int resultRows = bigImage.rows() - smallImage.rows() + 1;
            Mat result = new Mat(resultRows, resultCols, CvType.CV_32FC1);

            return applyImgProc(algorithm, bigImage, smallImage, result, template, bestResults);
        } catch (Exception e) {
            log.error("Error while searching for object: " + e.getMessage(), e);
        }

        return Collections.emptyList();
    }

    private List<CvResult> applyImgProc(CvProcessingAlgorithm algorithm, Mat bigImage, Mat smallImage, Mat result, CvTemplate template, int bestResults) {
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
            for(CvResult cvResult : results){
                saveCalculatedClickPoint(cvResult, template.getFilenamePrefix());
            }
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

    private void saveCalculatedClickPoint(CvResult cvResult, String fileNamePrefix){
        StringFilehandler.persist("calculated_click_point", fileNamePrefix, cvResult.toString());
    }

}
