package com.sfh.pokeRogueBot;

import com.sfh.pokeRogueBot.handler.LoginHandler;
import org.springframework.boot.ConfigurableBootstrapContext;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.io.File;

@SpringBootApplication
public class PokeRogueBotApplication {

	public static void main(String[] args) {
		System.setProperty("jna.library.path", "/opt/homebrew/opt/tesseract/lib/");
		System.setProperty("TESSDATA_PREFIX", "/opt/homebrew/Cellar/tesseract/5.3.4_1/share/");

		ConfigurableApplicationContext context = SpringApplication.run(PokeRogueBotApplication.class, args);
		try{
			LoginHandler loginHandler = context.getBean(LoginHandler.class);
			loginHandler.login();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
