package com.sfh.pokeRogueBot.config;

import com.sfh.pokeRogueBot.model.cv.CvProcessingAlgorithm;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SingletonBeanConfig {

    @Bean(name = "baseStagePathBean")
    public String getBaseStagePath(){
        return "./data/templates/login/login-screen.png"; //no real cheack needed for BaseStage
    }

    @Bean
    public CvProcessingAlgorithm getCvProcessingAlgorithm(){
        return CvProcessingAlgorithm.TM_SQDIFF;
    }
}
