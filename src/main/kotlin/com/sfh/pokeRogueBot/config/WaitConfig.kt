package com.sfh.pokeRogueBot.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "app.wait-time")
data class WaitConfig(
    val waitBriefly: Int,
    val waitLonger: Int,
)