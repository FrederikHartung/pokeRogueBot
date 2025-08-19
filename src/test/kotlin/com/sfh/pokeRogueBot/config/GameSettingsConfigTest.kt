package com.sfh.pokeRogueBot.config

import com.sfh.pokeRogueBot.model.dto.*
import com.sfh.pokeRogueBot.model.exception.InvalidGameSettingException
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class GameSettingsConfigTest {

    @Test
    fun `should create config with valid default values`() {
        // Given
        val config = GameSettingsConfig()

        // When & Then
        assertDoesNotThrow {
            config.validate()
        }
    }

    @Test
    fun `should validate successfully with all valid enum values`() {
        // Given
        val config = GameSettingsConfig(
            gameSpeed = "X1",
            hpBarSpeed = "NORMAL",
            expGainsSpeed = "SKIP",
            expParty = "LEVEL_UP_NOTIFICATION",
            eggSkipPreference = "ALWAYS",
            battleStyle = "SET"
        )

        // When & Then
        assertDoesNotThrow {
            config.validate()
        }
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid gameSpeed`() {
        // Given
        val config = GameSettingsConfig(gameSpeed = "INVALID_SPEED")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("gameSpeed", exception.settingName)
        assertEquals("INVALID_SPEED", exception.providedValue)
        assertTrue(exception.allowedValues.contains("X1"))
        assertTrue(exception.allowedValues.contains("X2"))
        assertTrue(exception.allowedValues.contains("X5"))
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid hpBarSpeed`() {
        // Given
        val config = GameSettingsConfig(hpBarSpeed = "INVALID_SPEED")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("hpBarSpeed", exception.settingName)
        assertEquals("INVALID_SPEED", exception.providedValue)
        assertTrue(exception.allowedValues.contains("NORMAL"))
        assertTrue(exception.allowedValues.contains("FAST"))
        assertTrue(exception.allowedValues.contains("FASTER"))
        assertTrue(exception.allowedValues.contains("SKIP"))
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid expGainsSpeed`() {
        // Given
        val config = GameSettingsConfig(expGainsSpeed = "WRONG_VALUE")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("expGainsSpeed", exception.settingName)
        assertEquals("WRONG_VALUE", exception.providedValue)
        assertEquals(4, exception.allowedValues.size)
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid expParty`() {
        // Given
        val config = GameSettingsConfig(expParty = "INVALID_PARTY")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("expParty", exception.settingName)
        assertEquals("INVALID_PARTY", exception.providedValue)
        assertTrue(exception.allowedValues.contains("NORMAL"))
        assertTrue(exception.allowedValues.contains("LEVEL_UP_NOTIFICATION"))
        assertTrue(exception.allowedValues.contains("SKIP"))
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid eggSkipPreference`() {
        // Given
        val config = GameSettingsConfig(eggSkipPreference = "MAYBE")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("eggSkipPreference", exception.settingName)
        assertEquals("MAYBE", exception.providedValue)
        assertTrue(exception.allowedValues.contains("NEVER"))
        assertTrue(exception.allowedValues.contains("ASK"))
        assertTrue(exception.allowedValues.contains("ALWAYS"))
    }

    @Test
    fun `should throw InvalidGameSettingException for invalid battleStyle`() {
        // Given
        val config = GameSettingsConfig(battleStyle = "RANDOM")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.validate()
        }

        assertEquals("battleStyle", exception.settingName)
        assertEquals("RANDOM", exception.providedValue)
        assertTrue(exception.allowedValues.contains("SWITCH"))
        assertTrue(exception.allowedValues.contains("SET"))
        assertEquals(2, exception.allowedValues.size)
    }

    @Test
    fun `should convert valid config to GameSettingsRequest`() {
        // Given
        val config = GameSettingsConfig(
            gameSpeed = "X2_5",
            hpBarSpeed = "FASTER",
            expGainsSpeed = "SKIP",
            expParty = "SKIP",
            skipSeenDialogues = false,
            eggSkipPreference = "NEVER",
            battleStyle = "SET",
            commandCursorMemory = false,
            enableRetries = false,
            hideIvs = true,
            enableTutorials = true,
            enableVibration = true,
            enableTouchControls = true
        )

        // When
        val request = config.toGameSettingsRequest()

        // Then
        assertEquals(GameSpeed.X2_5, request.gameSpeed)
        assertEquals(AnimationSpeed.FASTER, request.hpBarSpeed)
        assertEquals(AnimationSpeed.SKIP, request.expGainsSpeed)
        assertEquals(ExpParty.SKIP, request.expParty)
        assertEquals(false, request.skipSeenDialogues)
        assertEquals(EggSkipPreference.NEVER, request.eggSkipPreference)
        assertEquals(BattleStyle.SET, request.battleStyle)
        assertEquals(false, request.commandCursorMemory)
        assertEquals(false, request.enableRetries)
        assertEquals(true, request.hideIvs)
        assertEquals(true, request.enableTutorials)
        assertEquals(true, request.enableVibration)
        assertEquals(true, request.enableTouchControls)
    }

    @Test
    fun `should throw InvalidGameSettingException when converting invalid config to GameSettingsRequest`() {
        // Given
        val config = GameSettingsConfig(gameSpeed = "TURBO_MODE")

        // When & Then
        val exception = assertThrows<InvalidGameSettingException> {
            config.toGameSettingsRequest()
        }

        assertEquals("gameSpeed", exception.settingName)
        assertEquals("TURBO_MODE", exception.providedValue)
    }

    @Test
    fun `should convert GameSettingsRequest to JavaScript object correctly`() {
        // Given
        val config = GameSettingsConfig(
            gameSpeed = "X1_25",
            hpBarSpeed = "NORMAL",
            expGainsSpeed = "FAST",
            expParty = "LEVEL_UP_NOTIFICATION",
            skipSeenDialogues = true,
            eggSkipPreference = "ASK",
            battleStyle = "SWITCH"
        )

        // When
        val request = config.toGameSettingsRequest()
        val jsObject = request.toJavaScriptObject()

        // Then
        assertEquals(1.25, jsObject["gameSpeed"])
        assertEquals(0, jsObject["hpBarSpeed"])
        assertEquals(1, jsObject["expGainsSpeed"])
        assertEquals(1, jsObject["expParty"])
        assertEquals(true, jsObject["skipSeenDialogues"])
        assertEquals(1, jsObject["eggSkipPreference"])
        assertEquals(0, jsObject["battleStyle"])
    }

    @Test
    fun `should validate all GameSpeed enum values`() {
        val validSpeeds = listOf("X1", "X1_25", "X1_5", "X2", "X2_5", "X3", "X4", "X5")

        validSpeeds.forEach { speed ->
            val config = GameSettingsConfig(gameSpeed = speed)
            assertDoesNotThrow {
                config.validate()
            }
        }
    }

    @Test
    fun `should validate all AnimationSpeed enum values`() {
        val validSpeeds = listOf("NORMAL", "FAST", "FASTER", "SKIP")

        validSpeeds.forEach { speed ->
            val config1 = GameSettingsConfig(hpBarSpeed = speed)
            val config2 = GameSettingsConfig(expGainsSpeed = speed)

            assertDoesNotThrow {
                config1.validate()
            }
            assertDoesNotThrow {
                config2.validate()
            }
        }
    }

    @Test
    fun `should validate all ExpParty enum values`() {
        val validValues = listOf("NORMAL", "LEVEL_UP_NOTIFICATION", "SKIP")

        validValues.forEach { value ->
            val config = GameSettingsConfig(expParty = value)
            assertDoesNotThrow {
                config.validate()
            }
        }
    }

    @Test
    fun `should validate all EggSkipPreference enum values`() {
        val validValues = listOf("NEVER", "ASK", "ALWAYS")

        validValues.forEach { value ->
            val config = GameSettingsConfig(eggSkipPreference = value)
            assertDoesNotThrow {
                config.validate()
            }
        }
    }

    @Test
    fun `should validate all BattleStyle enum values`() {
        val validValues = listOf("SWITCH", "SET")

        validValues.forEach { value ->
            val config = GameSettingsConfig(battleStyle = value)
            assertDoesNotThrow {
                config.validate()
            }
        }
    }
}