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

    private static int fileIndex = 0;

    public static void incrementFileIndex(){
        fileIndex++;
    }

    public static int getFileIndex(){
        return fileIndex;
    }

    public void deleteTempData(){
        File folder = new File(Constants.DIR_TEMP);
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
