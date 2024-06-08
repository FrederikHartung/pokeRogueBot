package com.sfh.pokeRogueBot;

import com.sfh.pokeRogueBot.stage.Stage;
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
            String jsonStringPath = "./data/getEnemyTeam.js";

        } catch (Exception e) {
            log.error("Error starting the bot: " + e.getMessage(), e);
        }
    }
}
