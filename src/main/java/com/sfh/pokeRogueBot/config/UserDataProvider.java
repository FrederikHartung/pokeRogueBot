package com.sfh.pokeRogueBot.config;

import com.sfh.pokeRogueBot.model.UserData;
import com.sfh.pokeRogueBot.model.exception.NoUserDataFoundException;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

@Slf4j
public class UserDataProvider {

    private UserDataProvider() {
        // Utility class
    }

    public static UserData getUserdata(String path) throws NoUserDataFoundException {
        Map<String, String> configMap = readConfig(path);

        try{
            int index = 1;
            String key = "user" + index + "IsActive";
            while(configMap.containsKey(key)){
                if(Boolean.parseBoolean(configMap.get(key))){
                    UserData userData = new UserData();
                    userData.setUsername(configMap.get("user" + index + "Username"));
                    userData.setPassword(configMap.get("user" + index + "Password"));
                    return userData;
                }
                index++;
                key = "user" + index + "IsActive";
            }
        }
        catch (Exception e){
            log.error("Error parsing userData file: " + e.getMessage(), e);
        }

        throw new NoUserDataFoundException("No active user found in userData file, please add a active user to: " + path);
    }

    private static Map<String, String> readConfig(String filePath) {
        if(Files.notExists(new File(filePath).toPath())){
            try {
                //create empty .txt file
                String content = "user1Username=\nuser1Password=\nuser1IsActive=false";
                Files.write(new File(filePath).toPath(), content.getBytes());
            } catch (IOException e) {
                log.error("Error creating userData file: " + e.getMessage(), e);
            }
        }

        Map<String, String> configMap = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty() || line.startsWith("#")) { // Kommentare und leere Zeilen überspringen
                    continue;
                }
                String[] parts = line.split("=", 2);
                if (parts.length == 2) {
                    configMap.put(parts[0].trim(), parts[1].trim()); // Schlüssel und Wert in die Map einfügen
                }
            }
            log.debug("found number of values in userData file: " + configMap.size());
        } catch (IOException e) {
            log.error("Error reading userData file: " + e.getMessage(), e);
        }
        return configMap;
    }
}
