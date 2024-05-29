package com.sfh.pokeRogueBot.browser;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SingletonBeanConfig {

    @Bean
    public WebDriver webDriver() {
        ChromeOptions options = new ChromeOptions();

        // Pfad zum Benutzerdatenverzeichnis festlegen
        options.addArguments("user-data-dir=./bin/webdriver/profile/");
        return new ChromeDriver(options);
    }
}
