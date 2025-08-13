package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandler
import com.sfh.pokeRogueBot.model.exception.UiValidationFailedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import com.sfh.pokeRogueBot.service.javascript.JsUiService
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class UiValidatorTest {

    private lateinit var uiValidator: UiValidator
    private lateinit var jsUiService: JsUiService

    private lateinit var uiHandler: UiHandler

    val name = "TestUiHandler"
    val configOptionsLabel = listOf("A", "B", "C")
    val uiTemplate: PhaseUiTemplate = PhaseUiTemplate(
        15,
        name,
        true,
        3,
        configOptionsLabel,
    )
    val phaseName = "TestPhase"

    @BeforeEach
    fun setUp() {
        jsUiService = mockk()
        uiValidator = UiValidator(jsUiService)

        uiHandler = createHandler()
        every { jsUiService.getUiHandler(any()) } returns uiHandler
    }

    private fun createHandler(
        active: Boolean = true,
        awaitingActionInput: Boolean = true,
        index: Int = 15,
        name: String = "TestUiHandler",
        configOptionsSize: Int = 3,
        configOptionsLabel: List<String> = listOf("A", "B", "C")
    ): UiHandler {
        return UiHandler(
            active = active,
            awaitingActionInput = awaitingActionInput,
            index = index,
            name = name,
            configOptionsSize = configOptionsSize,
            configOptionsLabel = configOptionsLabel,
        )
    }

    @Test
    fun `a phase is validated and all checks are passing`() {
        assertDoesNotThrow { uiValidator.validateOrThrow(uiTemplate, phaseName) }
    }

    @Test
    fun `validateOrThrow throws because indexes are not matching`() {
        val handler = createHandler(index = 1)
        every { jsUiService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.index") }
    }

    @Test
    fun `validateOrThrow throws because handler names are not matching`() {
        val handler = createHandler(name = "OtherUiHandler")
        every { jsUiService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.name") }
    }

    @Test
    fun `validateOrThrow throws because configOptionsSize are not matching`() {
        val handler = createHandler(configOptionsSize = 5)
        every { jsUiService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.configOptionsSize") }
    }

    @Test
    fun `validateOrThrow throws because configOptionsAreMatching are not matching`() {
        val configOptions = listOf("A", "B", "C", "D")
        val handler = createHandler(configOptionsLabel = configOptions)
        every { jsUiService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.configOptionsLabel") }
    }
}