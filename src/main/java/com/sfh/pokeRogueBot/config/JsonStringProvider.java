package com.sfh.pokeRogueBot.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

public class JsonStringProvider {

    public static String loadJavaScriptFile(String filePath) throws IOException {
        return new String(Files.readAllBytes(Paths.get(filePath)));
    }
}
