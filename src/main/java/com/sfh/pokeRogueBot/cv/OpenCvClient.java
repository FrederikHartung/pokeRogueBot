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

}
