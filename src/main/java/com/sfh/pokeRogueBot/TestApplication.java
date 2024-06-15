package com.sfh.pokeRogueBot;

import com.google.gson.Gson;
import com.sfh.pokeRogueBot.model.run.Wave;
import com.sfh.pokeRogueBot.util.JsonUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication
@Slf4j
public class TestApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(Application.class, args);

        try {
            String jsonStringPath = "./bin/js/getCurrentWavePokemons.json";
            String jsonString = JsonUtils.readJsonString(jsonStringPath);
            Gson gson = new Gson();
            Wave wave = gson.fromJson(jsonString, Wave.class);
            System.out.println(jsonString);

        } catch (Exception e) {
            log.error("Error starting the bot: " + e.getMessage(), e);
        }
    }
}
