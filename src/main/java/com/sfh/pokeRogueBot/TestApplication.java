package com.sfh.pokeRogueBot;

import com.google.gson.Gson;
import com.sfh.pokeRogueBot.model.run.RunProperty;
import com.sfh.pokeRogueBot.model.run.WavePokemon;
import com.sfh.pokeRogueBot.service.RunPropertyService;
import com.sfh.pokeRogueBot.util.JsonUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.List;

@SpringBootApplication
@Slf4j
public class TestApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(Application.class, args);

        try {
            RunPropertyService service = context.getBean(RunPropertyService.class);
            List<RunProperty> properties = service.getAllRunProperties();
            System.out.println("found " + properties.size() + " properties");

        } catch (Exception e) {
            log.error("Error starting the bot: " + e.getMessage(), e);
        }
    }
}
