package com.sfh.pokeRogueBot;

import com.google.gson.Gson;
import com.sfh.pokeRogueBot.config.JsonStringProvider;
import com.sfh.pokeRogueBot.model.browser.GameJsonProperties;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Iv;
import com.sfh.pokeRogueBot.model.browser.pokemonjson.Stats;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication
@Slf4j
public class TestApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(Application.class, args);

        try{
            String jsonStringPath = "./data/getEnemyTeam.json";
            String jsonString = JsonStringProvider.readJsonString(jsonStringPath);
            Gson gson = new Gson();
            GameJsonProperties gameJsonProperties = gson.fromJson(jsonString, GameJsonProperties.class);
            System.out.println(jsonString);

        } catch (Exception e) {
            log.error("Error starting the bot: " + e.getMessage(), e);
        }
    }
}
