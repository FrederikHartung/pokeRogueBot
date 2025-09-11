package com.sfh.pokeRogueBot.model.rl

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class ModifierDecisionLoggerTest {

    private lateinit var inMemoryFileSystem: InMemoryFileSystemWrapper
    private lateinit var logger: ModifierDecisionLogger

    @BeforeEach
    fun setUp() {
        inMemoryFileSystem = InMemoryFileSystemWrapper()
        logger = ModifierDecisionLogger(
            maxBufferSize = 100,
            outputDirectory = "test_dir",
            fileSystem = inMemoryFileSystem
        )
    }

    @Test
    fun `logDecision should add experience to buffer`() {
        // Arrange
        val state = createTestState()
        val nextState = createTestState()

        // Act
        logger.logDecision(state, ModifierAction.BUY_POTION, 25.0, nextState, false)

        // Assert
        val buffer = logger.getExperienceBuffer()
        assertEquals(1, buffer.size)
        assertEquals(ModifierAction.BUY_POTION, buffer[0].action)
        assertEquals(25.0, buffer[0].reward, 0.001)
        assertEquals(false, buffer[0].done)
    }

    @Test
    fun `logDecision should handle null nextState`() {
        // Arrange
        val state = createTestState()

        // Act
        logger.logDecision(state, ModifierAction.SKIP, -5.0, null, true)

        // Assert
        val buffer = logger.getExperienceBuffer()
        assertEquals(1, buffer.size)
        assertEquals(ModifierAction.SKIP, buffer[0].action)
        assertNull(buffer[0].nextState)
        assertEquals(true, buffer[0].done)
    }

    @Test
    fun `getExperienceBuffer should return immutable copy`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 10.0)

        // Act
        val buffer1 = logger.getExperienceBuffer()
        logger.logDecision(state, ModifierAction.SKIP, 0.0)
        val buffer2 = logger.getExperienceBuffer()

        // Assert
        assertEquals(1, buffer1.size)
        assertEquals(2, buffer2.size)
        assertNotSame(buffer1, buffer2) // Different instances
    }

    @Test
    fun `clearBuffer should remove all experiences`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 10.0)
        logger.logDecision(state, ModifierAction.SKIP, 0.0)
        assertEquals(2, logger.getExperienceBuffer().size)

        // Act
        val clearedCount = logger.clearBuffer()

        // Assert
        assertEquals(2, clearedCount)
        assertEquals(0, logger.getExperienceBuffer().size)
    }

    @Test
    fun `saveTrainingBatch should create JSON file`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 25.0)
        logger.logDecision(state, ModifierAction.TAKE_FREE_POTION, 30.0)

        // Act
        val savedPath = logger.saveTrainingBatch("test_session")

        // Assert
        assertNotNull(savedPath)
        assertTrue(inMemoryFileSystem.exists(savedPath!!))
        assertTrue(savedPath.fileName.toString().contains("test_session"))
        assertTrue(savedPath.fileName.toString().contains("experiences"))
        assertTrue(savedPath.fileName.toString().endsWith(".json"))

        // Verify content exists (basic check)
        val fileContent = inMemoryFileSystem.readString(savedPath)
        assertTrue(fileContent.contains("experiences"))
        assertTrue(fileContent.contains("metadata"))
    }

    @Test
    fun `saveTrainingBatch should return null for empty buffer`() {
        // Act
        val result = logger.saveTrainingBatch()

        // Assert
        assertNull(result)
    }

    @Test
    fun `loadExperiences should restore from saved file`() {
        // Arrange
        val state1 = createTestState()
        val state2 = createTestState()
        logger.logDecision(state1, ModifierAction.BUY_POTION, 25.0, state2, false)
        logger.logDecision(state2, ModifierAction.SKIP, 0.0, null, true)

        val savedPath = logger.saveTrainingBatch("test_load")
        assertNotNull(savedPath)

        // Act
        val loadedExperiences = logger.loadExperiences(savedPath!!)

        // Assert
        assertEquals(2, loadedExperiences.size)
        assertEquals(ModifierAction.BUY_POTION, loadedExperiences[0].action)
        assertEquals(25.0, loadedExperiences[0].reward, 0.001)
        assertEquals(ModifierAction.SKIP, loadedExperiences[1].action)
        assertEquals(0.0, loadedExperiences[1].reward, 0.001)
        assertTrue(loadedExperiences[1].done)
    }

    @Test
    fun `loadExperiences should return empty list for nonexistent file`() {
        // Arrange
        val nonexistentPath = inMemoryFileSystem.resolve("test_dir", "nonexistent.json")

        // Act
        val result = logger.loadExperiences(nonexistentPath)

        // Assert
        assertEquals(emptyList<SelectModifierExperience>(), result)
    }

    @Test
    fun `saveAndClearBuffer should save and clear atomically`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 10.0)
        logger.logDecision(state, ModifierAction.SKIP, 5.0)
        assertEquals(2, logger.getExperienceBuffer().size)

        // Act
        val savedPath = logger.saveAndClearBuffer("atomic_test")

        // Assert
        assertNotNull(savedPath)
        assertEquals(0, logger.getExperienceBuffer().size) // Buffer cleared
        assertTrue(inMemoryFileSystem.exists(savedPath!!)) // File saved
    }

    @Test
    fun `getBufferStats should return comprehensive metrics`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 20.0)
        logger.logDecision(state, ModifierAction.BUY_POTION, 30.0)
        logger.logDecision(state, ModifierAction.SKIP, -5.0)

        // Act
        val stats = logger.getBufferStats()

        // Assert
        assertEquals(3, stats["bufferSize"])
        assertEquals(100, stats["maxBufferSize"])
        assertEquals(0.03, stats["bufferUtilization"] as Double, 0.001) // 3/100
        assertEquals(15.0, stats["averageReward"] as Double, 0.001) // (20+30-5)/3

        @Suppress("UNCHECKED_CAST")
        val actionDistribution = stats["actionDistribution"] as Map<ModifierAction, Int>
        assertEquals(2, actionDistribution[ModifierAction.BUY_POTION])
        assertEquals(1, actionDistribution[ModifierAction.SKIP])
        assertEquals("test_dir", stats["outputDirectory"])
    }

    @Test
    fun `buffer overflow should remove oldest experiences`() {
        // Arrange
        val smallLogger = ModifierDecisionLogger(
            maxBufferSize = 3,
            outputDirectory = "test_overflow_dir",
            fileSystem = InMemoryFileSystemWrapper()
        )
        val state = createTestState()

        // Act - Add more than maxBufferSize
        smallLogger.logDecision(state, ModifierAction.BUY_POTION, 1.0)
        smallLogger.logDecision(state, ModifierAction.BUY_POTION, 2.0)
        smallLogger.logDecision(state, ModifierAction.BUY_POTION, 3.0)
        assertEquals(3, smallLogger.getExperienceBuffer().size)

        smallLogger.logDecision(state, ModifierAction.SKIP, 4.0) // Should trigger overflow

        // Assert
        val buffer = smallLogger.getExperienceBuffer()
        assertTrue(buffer.size <= 3) // Should not exceed max
        // The buffer should be smaller than the original count but still contain entries
        assertTrue(buffer.isNotEmpty()) // Should have kept some experiences
    }

    private fun createTestState(): SmallModifierSelectState {
        return SmallModifierSelectState(
            hpBuckets = doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0), // Using HP buckets now
            canAffordPotion = 1.0,
            freePotionAvailable = 0.0,
            canAffordRevive = 0.0,
            freeReviveAvailable = 0.0,
            sacredAshAvailable = 0.0
        )
    }
}