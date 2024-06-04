package com.sfh.pokeRogueBot.cv;

import com.sfh.pokeRogueBot.filehandler.CvResultFilehandler;
import com.sfh.pokeRogueBot.filehandler.TempFileManager;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;

@Deprecated
public class TestCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    public double get(String mainImagePath, String templateImagePath){
        try{
            Mat canvas = Imgcodecs.imread(mainImagePath);
            Mat template = Imgcodecs.imread(templateImagePath);

            Mat outputImage = new Mat(canvas.rows() - template.rows() + 1, canvas.cols() - template.cols() + 1, CvType.CV_32FC1);

            Imgproc.matchTemplate(canvas, template, outputImage, Imgproc.TM_SQDIFF);

            Core.MinMaxLocResult mmr = Core.minMaxLoc(outputImage);

            return mmr.minVal;
        }
        catch (Exception e){
            return 1;
        }
    }

    public void draw(String mainImagePath, String templateImagePath, String prefix){
        TempFileManager tempFileManager = new TempFileManager();
        tempFileManager.deleteTempData();

        Mat canvas = Imgcodecs.imread(mainImagePath);
        Mat template = Imgcodecs.imread(templateImagePath);

        Mat outputImage = new Mat(canvas.rows() - template.rows() + 1, canvas.cols() - template.cols() + 1, CvType.CV_32FC1);

        Imgproc.matchTemplate(canvas, template, outputImage, Imgproc.TM_SQDIFF);
        Core.normalize(outputImage, outputImage, 0, 255, Core.NORM_MINMAX, -1, new Mat());

        Core.MinMaxLocResult mmr = Core.minMaxLoc(outputImage);
        Point matchLoc = mmr.maxLoc;
        Imgproc.rectangle(canvas, matchLoc, new Point(matchLoc.x + template.cols(), matchLoc.y + template.rows()), new Scalar(0, 255, 0), 2);
        Imgproc.rectangle(outputImage, matchLoc, new Point(matchLoc.x + template.cols(), matchLoc.y + template.rows()), new Scalar(0, 255, 0), 2);
        CvResultFilehandler.persist(prefix, canvas);

        //write resultfile out
        System.out.println("max: " + mmr.maxVal + ", min: " + mmr.minVal);
        String resultPath = "./data/temp/" + prefix + "_result.png";
        Imgcodecs.imwrite(resultPath, outputImage);
        Imgcodecs.imwrite("./data/temp/template.png", template);
    }
}
