package com.sfh.pokeRogueBot.cv;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OcrConfig {

    @Bean
    public ITesseract tesseract(@Value("${ocr.datapath}") String dataPath,
                                @Value("${ocr.language}") String language,
                                @Value("${ocr.jnaLibraryPath}") String jnaLibraryPath){

        System.setProperty("jna.library.path", jnaLibraryPath);

        Tesseract tesseract = new Tesseract();
        tesseract.setDatapath(dataPath);
        tesseract.setLanguage(language);

        return new Tesseract();
    }
}
