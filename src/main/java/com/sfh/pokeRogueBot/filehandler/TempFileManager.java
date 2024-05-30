package com.sfh.pokeRogueBot.filehandler;

import com.sfh.pokeRogueBot.config.Constants;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;

@Component
@Slf4j
public class TempFileManager {

    public static int fileIndex = 0;

    public void deleteTempData(){
        deleteOldScreenshots();
        deleteOldClickScreenshots();
        deleteOldCvResults();
    }

    private void deleteOldScreenshots(){
        File folder = new File(Constants.DIR_SCREENSHOTS_TEMP);
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

    private void deleteOldClickScreenshots(){
        File folder = new File(Constants.DIR_SCREENSHOTS_CLICK_TEMP);
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
        File folder = new File(Constants.DIR_CV_RESULTS_TEMP);
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
