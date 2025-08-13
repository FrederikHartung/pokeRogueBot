package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.config.GameSettingsConfig
import com.sfh.pokeRogueBot.config.WaitConfig
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@EnableConfigurationProperties(WaitConfig::class, GameSettingsConfig::class)
@SpringBootApplication
class Application

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}
