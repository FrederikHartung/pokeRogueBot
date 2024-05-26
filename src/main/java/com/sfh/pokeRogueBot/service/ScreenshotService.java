package com.sfh.pokeRogueBot.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@Slf4j
public class ScreenshotService {

    public void deleteAllOldScreenshots(){
        File folder = new File("./bin/screenshots");
        File[] files = folder.listFiles();
        for(File file : files){
            if(!file.delete()){

            }
        }
    }
}
