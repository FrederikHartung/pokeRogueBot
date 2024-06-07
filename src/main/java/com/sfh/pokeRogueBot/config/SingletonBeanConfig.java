package com.sfh.pokeRogueBot.config;

import com.sfh.pokeRogueBot.model.cv.CvProcessingAlgorithm;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SingletonBeanConfig {

    @Bean
    public CvProcessingAlgorithm getCvProcessingAlgorithm(){
        return CvProcessingAlgorithm.TM_SQDIFF;
    }
}
