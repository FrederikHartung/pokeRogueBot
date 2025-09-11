package com.sfh.pokeRogueBot.model.rl

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ExperienceTest {

    @Test
    fun `toMap should serialize experience correctly`() {
        // Arrange
        val state = createTestState(doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0))
        val nextState = createTestState(doubleArrayOf(1.0, 0.9, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0))
        val selectModifierExperience = SelectModifierExperience(
            state = state,
            action = ModifierAction.BUY_POTION,
            reward = 25.0,
            nextState = nextState,
            done = false,
            timestamp = 1640995200000L // Fixed timestamp
        )

        // Act
        val result = selectModifierExperience.toMap()

        // Assert
        assertEquals(listOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0), result["state"])
        assertEquals(0, result["action"]) // BUY_POTION actionId
        assertEquals(25.0, result["reward"])
        assertEquals(listOf(1.0, 0.9, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0), result["nextState"])
        assertEquals(false, result["done"])
        assertEquals(1640995200000L, result["timestamp"])
    }

    @Test
    fun `toMap should handle null nextState`() {
        // Arrange
        val state = createTestState(doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0))
        val selectModifierExperience = SelectModifierExperience(
            state = state,
            action = ModifierAction.SKIP,
            reward = -5.0,
            nextState = null,
            done = true
        )

        // Act
        val result = selectModifierExperience.toMap()

        // Assert
        assertNull(result["nextState"])
        assertEquals(true, result["done"])
        assertEquals(2, result["action"]) // SKIP actionId
    }

    @Test
    fun `fromMap should deserialize experience correctly`() {
        // Arrange
        val map = mapOf(
            "state" to listOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0),
            "action" to 1, // TAKE_FREE_POTION
            "reward" to 30.0,
            "nextState" to listOf(1.0, 1.0, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0),
            "done" to false,
            "timestamp" to 1640995200000L
        )

        // Act
        val result = SelectModifierExperience.fromMap(map)

        // Assert
        assertArrayEquals(doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0), result.state.toArray(), 0.001)
        assertEquals(ModifierAction.TAKE_FREE_POTION, result.action)
        assertEquals(30.0, result.reward, 0.001)
        assertArrayEquals(doubleArrayOf(1.0, 1.0, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0), result.nextState?.toArray(), 0.001)
        assertEquals(false, result.done)
        assertEquals(1640995200000L, result.timestamp)
    }

    @Test
    fun `fromMap should handle null nextState`() {
        // Arrange
        val map = mapOf(
            "state" to listOf(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            "action" to 2, // SKIP
            "reward" to -10.0,
            "nextState" to null,
            "done" to true,
            "timestamp" to 1640995200000L
        )

        // Act
        val result = SelectModifierExperience.fromMap(map)

        // Assert
        assertNull(result.nextState)
        assertEquals(true, result.done)
        assertEquals(ModifierAction.SKIP, result.action)
    }

    @Test
    fun `fromMap should throw exception for invalid action ID`() {
        // Arrange
        val map = mapOf(
            "state" to listOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0),
            "action" to 99, // Invalid action ID
            "reward" to 0.0,
            "nextState" to null,
            "done" to false,
            "timestamp" to 1640995200000L
        )

        // Act & Assert
        val exception = assertThrows(IllegalArgumentException::class.java) {
            SelectModifierExperience.fromMap(map)
        }
        assertTrue(exception.message?.contains("Invalid action ID: 99") == true)
    }

    @Test
    fun `roundtrip serialization should preserve experience`() {
        // Arrange
        val originalState = createTestState(doubleArrayOf(0.5, 0.7, 0.3, 0.9, 0.1, 0.8, 0.0, 1.0, 0.5, 0.0, 1.0))
        val originalNextState = createTestState(doubleArrayOf(0.6, 0.8, 0.4, 1.0, 0.2, 0.9, 0.0, 1.0, 0.5, 0.0, 1.0))
        val original = SelectModifierExperience(
            state = originalState,
            action = ModifierAction.BUY_POTION,
            reward = 42.5,
            nextState = originalNextState,
            done = false
        )

        // Act
        val map = original.toMap()
        val recreated = SelectModifierExperience.fromMap(map)

        // Assert
        assertArrayEquals(original.state.toArray(), recreated.state.toArray(), 0.001)
        assertEquals(original.action, recreated.action)
        assertEquals(original.reward, recreated.reward, 0.001)
        assertArrayEquals(original.nextState?.toArray(), recreated.nextState?.toArray(), 0.001)
        assertEquals(original.done, recreated.done)
        assertEquals(original.timestamp, recreated.timestamp)
    }

    @Test
    fun `constructor should use current time by default`() {
        // Arrange
        val state = createTestState(doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0, 0.5, 0.0, 1.0))
        val beforeTime = System.currentTimeMillis()

        // Act
        val selectModifierExperience = SelectModifierExperience(
            state = state,
            action = ModifierAction.SKIP,
            reward = 0.0,
            nextState = null
        )

        // Assert
        val afterTime = System.currentTimeMillis()
        assertTrue(selectModifierExperience.timestamp >= beforeTime)
        assertTrue(selectModifierExperience.timestamp <= afterTime)
    }

    private fun createTestState(array: DoubleArray): SmallModifierSelectState {
        return SmallModifierSelectState.fromArray(array)
    }
}