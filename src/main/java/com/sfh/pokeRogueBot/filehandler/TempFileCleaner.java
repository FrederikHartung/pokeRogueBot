package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;

@Component
@Slf4j
public class TempFileCleaner {

    public void deleteTempData(){
        deleteOldScreenshots();
        deleteOldCvResults();
    }

    private void deleteOldScreenshots(){
        File folder = new File(Constants.SCREENSHOTS_TEMP_DIR);
        File[] files = folder.listFiles();
        if(files == null){
            return;
        }

        for(File file : files){
            if(null == file){
                continue;
            }

            if(file.isFile()){
                try{
                    Files.deleteIfExists(file.toPath());
                } catch (Exception e){
                    log.error("Could not delete file: " + file.getName());
                }
            }
        }
    }

    private void deleteOldCvResults(){
        File folder = new File(Constants.CV_RESULTS_TEMP_DIR);
        File[] files = folder.listFiles();
        if(files == null){
            return;
        }

        for(File file : files){
            if(null == file){
                continue;
            }

            if(file.isFile()){
                try{
                    Files.deleteIfExists(file.toPath());
                } catch (Exception e){
                    log.error("Could not delete file: " + file.getName());
                }
            }
        }
    }
}
