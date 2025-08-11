package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.model.browser.gamejson.UiHandler
import com.sfh.pokeRogueBot.model.exception.UiValidationFailedException
import com.sfh.pokeRogueBot.model.ui.PhaseUiTemplate
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class UiValidatorTest {

    private lateinit var uiValidator: UiValidator
    private lateinit var jsService: JsService

    private lateinit var uiHandler: UiHandler

    val name = "TestUiHandler"
    val configOptionsLabel = arrayOf("A", "B", "C")
    val uiTemplate: PhaseUiTemplate = PhaseUiTemplate(
        15,
        name,
        3,
        configOptionsLabel,
    )
    val phaseName = "TestPhase"

    @BeforeEach
    fun setUp() {
        jsService = mockk()
        uiValidator = UiValidator(jsService)

        uiHandler = createHandler()
        every { jsService.getUiHandler(any()) } returns uiHandler
    }

    private fun createHandler(
        active: Boolean = true,
        awaitingActionInput: Boolean = true,
        index: Int = 15,
        name: String = "TestUiHandler",
        configOptionsSize: Int = 3,
        configOptionsLabel: Array<String> = arrayOf("A", "B", "C")
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
    fun `two identical configOptionsLabel are returning true in configOptionsAreMatching`() {
        assertTrue(uiValidator.configOptionsAreMatching(uiTemplate.configOptionsLabel, uiTemplate.configOptionsLabel))
    }

    @Test
    fun `two not identical configOptionsLabel are returning false in configOptionsAreMatching`() {
        val notMatchingConfigOptionsLabel = arrayOf("D", "B", "C")
        assertFalse(uiValidator.configOptionsAreMatching(uiTemplate.configOptionsLabel, notMatchingConfigOptionsLabel))
    }

    @Test
    fun `two arrays with different length are returning false in configOptionsAreMatching`() {
        val notMatchingConfigOptionsLabel = arrayOf("A", "B", "C", "D")
        assertFalse(uiValidator.configOptionsAreMatching(uiTemplate.configOptionsLabel, notMatchingConfigOptionsLabel))
    }

    @Test
    fun `a phase is validated and all checks are passing`() {
        assertDoesNotThrow { uiValidator.validateOrThrow(uiTemplate, phaseName) }
    }

    @Test
    fun `validateOrThrow throws because indexes are not matching`() {
        val handler = createHandler(index = 1)
        every { jsService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.index") }
    }

    @Test
    fun `validateOrThrow throws because handler names are not matching`() {
        val handler = createHandler(name = "OtherUiHandler")
        every { jsService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.name") }
    }

    @Test
    fun `validateOrThrow throws because configOptionsSize are not matching`() {
        val handler = createHandler(configOptionsSize = 5)
        every { jsService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.configOptionsSize") }
    }

    @Test
    fun `validateOrThrow throws because configOptionsAreMatching are not matching`() {
        val configOptions = arrayOf("A", "B", "C", "D")
        val handler = createHandler(configOptionsLabel = configOptions)
        every { jsService.getUiHandler(any()) } returns handler
        val e = assertThrows<UiValidationFailedException> {
            uiValidator.validateOrThrow(uiTemplate, phaseName)
        }
        assertTrue { e.message!!.contains("uiHandler.configOptionsLabel") }
    }
}