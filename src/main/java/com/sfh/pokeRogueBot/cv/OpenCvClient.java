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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.Nullable;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Slf4j
@Component
public class OpenCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    private final CvProcessingAlgorithm algorithm;
    private final CvResultFilehandler cvResultFilehandler;
    private final int allowedToleranceForTopLeftMismatch;

    /*
     CvProcessingAlgorithm is configered in SingletonBeanConfig
     */
    public OpenCvClient(CvProcessingAlgorithm algorithm,
                        CvResultFilehandler cvResultFilehandler,
                        @Value("${cv.allowedToleranceForTopLeftMismatch:5}") int allowedToleranceForTopLeftMismatch) {
        this.algorithm = algorithm;
        this.cvResultFilehandler = cvResultFilehandler;
        this.allowedToleranceForTopLeftMismatch = allowedToleranceForTopLeftMismatch;
    }

    @Nullable
    public CvResult findTemplateInBufferedImage(BufferedImage canvasImg, BufferedImage templateImg, CvTemplate template) {
        try{
            //create the mats
            Mat bigImage = bufferedImageToMat(canvasImg);
            Mat smallImage = bufferedImageToMat(templateImg);
            int resultCols = bigImage.cols() - smallImage.cols() + 1;
            int resultRows = bigImage.rows() - smallImage.rows() + 1;
            Mat result = new Mat(resultRows, resultCols, CvType.CV_32FC1);

            //do template matching and get match point
            Imgproc.matchTemplate(bigImage, smallImage, result, algorithm.getAlgorithm());
            Core.normalize(result, result, 0, 1, Core.NORM_MINMAX, -1, new Mat());
            Core.MinMaxLocResult mmr = Core.minMaxLoc(result);
            log.debug(template.getFilenamePrefix() + ": min: " + mmr.minVal + ", max: " + mmr.maxVal);
            Point matchLoc = algorithm.getFilterType() == CvFilterType.HIGHEST_Result ? mmr.maxLoc : mmr.minLoc;

            //draw rectangle around found object
            if(template.persistResultWhenFindingTemplate()){
                Imgproc.rectangle(bigImage, matchLoc, new Point(matchLoc.x + smallImage.cols(), matchLoc.y + smallImage.rows()), new Scalar(0, 255, 0), 2);
            }

            //calculate middle point of found object
            int xTopLeft = (int) Math.round(matchLoc.x);
            int yTopLeft = (int) Math.round(matchLoc.y);
            int xMiddle = (int) Math.round(matchLoc.x + (smallImage.cols() / 2d));
            int yMiddle = (int) Math.round(matchLoc.y + (smallImage.rows() / 2d));
            CvResult cvResult = new CvResult(
                    new com.sfh.pokeRogueBot.model.cv.Point(xTopLeft, yTopLeft),
                    new com.sfh.pokeRogueBot.model.cv.Point(xMiddle, yMiddle),
                    new com.sfh.pokeRogueBot.model.cv.Size(smallImage.cols(), smallImage.rows())
            );
            log.debug(template.getFilenamePrefix() + ": Found object at: " + cvResult);

            if(foundPositionIsInExpectedArrea(cvResult, template.getExpectedTopLeft())){
                if(template.persistResultWhenFindingTemplate()){
                    persist(template.getFilenamePrefix() + "_ok_", bigImage, cvResult);
                }
                return cvResult;
            }
            else{
                log.warn(template.getFilenamePrefix() + ": Found object at: " + cvResult + " is not in expected area");
                if(template.persistResultOnError()){
                    persist(template.getFilenamePrefix() + "_wrong-position_", bigImage, cvResult);
                }
                return null;
            }
        }
        catch (Exception e) {
            log.error("Error while searching for object '" + template.getFilenamePrefix() +"' : " + e.getMessage(), e);
            if(template.persistResultOnError()){
                persist(template.getFilenamePrefix() + "_error_", canvasImg);
            }
            return null;
        }
    }

    private void persist(String fileNamePrefix, Mat canvas, CvResult cvResult) {
        cvResultFilehandler.persist(fileNamePrefix, canvas);
        saveCalculatedClickPoint(cvResult, fileNamePrefix);
    }

    private void persist(String fileNamePrefix, BufferedImage canvas) {
        cvResultFilehandler.persist(fileNamePrefix, canvas);
    }

    public boolean foundPositionIsInExpectedArrea(CvResult resultToCheck, com.sfh.pokeRogueBot.model.cv.Point expectedTopLeft){

        int xTopLeft = resultToCheck.getTopLeft().getX();
        int yTopLeft = resultToCheck.getTopLeft().getY();

        int xExpectedTopLeft = expectedTopLeft.getX();
        int yExpectedTopLeft = expectedTopLeft.getY();

        boolean xTopLeftMatch = xTopLeft >= (xExpectedTopLeft - allowedToleranceForTopLeftMismatch) && xTopLeft <= (xExpectedTopLeft + allowedToleranceForTopLeftMismatch);
        boolean yTopLeftMatch = yTopLeft >= (yExpectedTopLeft - allowedToleranceForTopLeftMismatch) && yTopLeft <= (yExpectedTopLeft + allowedToleranceForTopLeftMismatch);

        return xTopLeftMatch && yTopLeftMatch;
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
