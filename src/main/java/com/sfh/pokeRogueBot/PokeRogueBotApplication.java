package com.sfh.pokeRogueBot;

import com.sfh.pokeRogueBot.bot.Bot;
import com.sfh.pokeRogueBot.bot.SimpleBot;
import com.sfh.pokeRogueBot.template.Template;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.List;

@SpringBootApplication
@Slf4j
public class PokeRogueBotApplication {

	public static void main(String[] args) {
		ConfigurableApplicationContext context = SpringApplication.run(PokeRogueBotApplication.class, args);
		try{
			Bot bot = context.getBean(SimpleBot.class);
            bot.start();
        } catch (Exception e) {
			log.error("Error starting the bot: " + e.getMessage(), e);
		}
	}
}
