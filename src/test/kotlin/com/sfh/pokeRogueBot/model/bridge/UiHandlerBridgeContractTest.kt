package com.sfh.pokeRogueBot.model.bridge

import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandlerDto
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path

class UiHandlerBridgeContractTest {

    private val gson = GsonBuilder().create()
    private val fixturePath = Path.of("src", "test", "resources", "bridge", "uihandler", "command-handler.json")

    @Test
    fun `ui handler bridge fixture deserializes into kotlin model`() {
        val handlerDto = deserializeFixture()

        assertTrue(handlerDto.active)
        assertTrue(handlerDto.awaitingActionInput)
        assertEquals(2, handlerDto.index)
        assertEquals("CommandUiHandler", handlerDto.name)
        assertEquals(4, handlerDto.configOptionsSize)
        assertEquals(listOf("Fight", "Ball", "Pokemon", "Run"), handlerDto.configOptionsLabel)
    }

    @Test
    fun `ui handler bridge fixture passes sanity validation`() {
        val handlerDto = deserializeFixture()

        validateUiHandlerContract(handlerDto)
    }

    private fun deserializeFixture(): UiHandlerDto {
        check(Files.exists(fixturePath)) { "Missing fixture at $fixturePath" }
        return gson.fromJson(Files.readString(fixturePath), UiHandlerDto::class.java)
    }

    private fun validateUiHandlerContract(handlerDto: UiHandlerDto) {
        require(handlerDto.index >= 0) { "handler index must not be negative" }
        require(handlerDto.name.isNotBlank()) { "handler name must not be blank" }
        require(handlerDto.configOptionsSize >= 0) { "configOptionsSize must not be negative" }
        require(handlerDto.configOptionsSize == handlerDto.configOptionsLabel.size) {
            "configOptionsSize must match configOptionsLabel size"
        }
        require(handlerDto.configOptionsLabel.none { it.isBlank() }) {
            "configOptionsLabel entries must not be blank"
        }
    }
}
