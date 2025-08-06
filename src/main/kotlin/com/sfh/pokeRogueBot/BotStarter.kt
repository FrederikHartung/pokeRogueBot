package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.bot.SimpleBot
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.stereotype.Component

@Component
class BotStarter(val simpleBot: SimpleBot): ApplicationRunner {

    override fun run(args: ApplicationArguments?) {
        simpleBot.start()
    }

}