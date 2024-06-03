package com.sfh.pokeRogueBot;

import com.sfh.pokeRogueBot.bot.Bot;
import com.sfh.pokeRogueBot.bot.SimpleBot;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication
@Slf4j
public class Application {

	public static void main(String[] args) {
		ConfigurableApplicationContext context = SpringApplication.run(Application.class, args);
		try{
			Bot bot = context.getBean(SimpleBot.class);
            bot.start();
        } catch (Exception e) {
			log.error("Error starting the bot: " + e.getMessage(), e);
		}
	}
}
