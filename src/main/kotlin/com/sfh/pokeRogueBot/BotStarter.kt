package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.bot.SimpleBot
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component

@Component
@Profile("!training-only")  // Disable BotStarter when training-only profile is active
class BotStarter(val simpleBot: SimpleBot): ApplicationRunner {

    override fun run(args: ApplicationArguments?) {
        simpleBot.start()
    }

}