package com.sfh.pokeRogueBot.cv;

import lombok.extern.slf4j.Slf4j;
import org.opencv.core.Core;
import org.opencv.core.Mat;
import org.opencv.imgcodecs.Imgcodecs;

@Slf4j
public class OpenCvClient {

    static {
        nu.pattern.OpenCV.loadLocally();
    }

    public static void test(){
        try{
            String imagePath = "./bin/screenshots/login_0.png";

            // Das Bild wird hier geladen
            Mat image = Imgcodecs.imread(imagePath);
        }
        catch (Exception e){
            log.error("Error while loading OpenCV: " + e.getMessage(), e);
        }
    }
}
