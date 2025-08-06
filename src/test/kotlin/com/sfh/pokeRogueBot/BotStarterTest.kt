package com.sfh.pokeRogueBot

import com.sfh.pokeRogueBot.bot.SimpleBot
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test
import org.springframework.boot.DefaultApplicationArguments

class BotStarterTest {

    @Test
    fun `run should start the bot`() {
        val bot: SimpleBot = mockk(relaxed = true) {}
        val botStarter = BotStarter(bot)
        assertDoesNotThrow { botStarter.run(DefaultApplicationArguments()) }
        verify { bot.start() }
    }
}