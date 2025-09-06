package com.sfh.pokeRogueBot.model.rl

import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.nio.file.Path

class ModifierDecisionLoggerWithMockTest {

    private lateinit var mockFileSystem: FileSystemWrapper
    private lateinit var logger: ModifierDecisionLogger
    private lateinit var mockPath: Path

    @BeforeEach
    fun setUp() {
        mockFileSystem = mockk()
        mockPath = mockk()

        // Mock the path creation and directory operations
        every { mockFileSystem.toPath("test_dir") } returns mockPath
        every { mockFileSystem.exists(mockPath) } returns true

        logger = ModifierDecisionLogger(
            maxBufferSize = 100,
            outputDirectory = "test_dir",
            fileSystem = mockFileSystem
        )
    }

    @Test
    fun `saveTrainingBatch should use mocked file system`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.BUY_POTION, 25.0)

        val expectedFilePath = mockk<Path>()
        every { mockFileSystem.resolve("test_dir", any<String>()) } returns expectedFilePath
        every { mockFileSystem.writeString(expectedFilePath, any<String>()) } returns expectedFilePath

        // Act
        val result = logger.saveTrainingBatch("test_session")

        // Assert
        assertNotNull(result)
        assertEquals(expectedFilePath, result)
        verify { mockFileSystem.writeString(expectedFilePath, any<String>()) }
        verify { mockFileSystem.resolve("test_dir", any<String>()) }
    }

    @Test
    fun `loadExperiences should use mocked file system`() {
        // Arrange
        val filePath = mockk<Path>()
        val jsonContent = """
        {
          "metadata": {
            "timestamp": "20250830_120000",
            "sessionId": "test",
            "experienceCount": 1,
            "stateSize": 8,
            "actionCount": 3
          },
          "experiences": [
            {
              "state": [1.0, 0.8, 0.6, 0.4, 0.2, 0.0, 1.0, 0.0],
              "action": 0,
              "reward": 25.0,
              "nextState": null,
              "done": false,
              "timestamp": 1640995200000
            }
          ]
        }
        """.trimIndent()

        every { mockFileSystem.exists(filePath) } returns true
        every { mockFileSystem.readString(filePath) } returns jsonContent

        // Act
        val result = logger.loadExperiences(filePath)

        // Assert
        assertEquals(1, result.size)
        assertEquals(ModifierAction.BUY_POTION, result[0].action)
        assertEquals(25.0, result[0].reward, 0.001)
        verify { mockFileSystem.exists(filePath) }
        verify { mockFileSystem.readString(filePath) }
    }

    @Test
    fun `loadExperiences should return empty list for nonexistent file`() {
        // Arrange
        val filePath = mockk<Path>()
        every { mockFileSystem.exists(filePath) } returns false

        // Act
        val result = logger.loadExperiences(filePath)

        // Assert
        assertEquals(emptyList<Experience>(), result)
        verify { mockFileSystem.exists(filePath) }
        verify(exactly = 0) { mockFileSystem.readString(any()) }
    }

    @Test
    fun `saveAndClearBuffer should use mocked file system and clear buffer`() {
        // Arrange
        val state = createTestState()
        logger.logDecision(state, ModifierAction.SKIP, -5.0)
        logger.logDecision(state, ModifierAction.BUY_POTION, 10.0)
        assertEquals(2, logger.getExperienceBuffer().size)

        val expectedFilePath = mockk<Path>()
        every { mockFileSystem.resolve("test_dir", any<String>()) } returns expectedFilePath
        every { mockFileSystem.writeString(expectedFilePath, any<String>()) } returns expectedFilePath

        // Act
        val result = logger.saveAndClearBuffer("mock_test")

        // Assert
        assertNotNull(result)
        assertEquals(expectedFilePath, result)
        assertEquals(0, logger.getExperienceBuffer().size) // Buffer should be cleared
        verify { mockFileSystem.writeString(expectedFilePath, any<String>()) }
    }

    @Test
    fun `constructor should create directory when it doesn't exist`() {
        // Arrange
        val newMockFileSystem = mockk<FileSystemWrapper>()
        val outputPath = mockk<Path>()

        every { newMockFileSystem.toPath("new_dir") } returns outputPath
        every { newMockFileSystem.exists(outputPath) } returns false
        every { newMockFileSystem.createDirectories(outputPath) } returns outputPath

        // Act
        ModifierDecisionLogger(
            maxBufferSize = 50,
            outputDirectory = "new_dir",
            fileSystem = newMockFileSystem
        )

        // Assert
        verify { newMockFileSystem.createDirectories(outputPath) }
    }

    @Test
    fun `saveTrainingBatch should return null for empty buffer`() {
        // Arrange - logger has no experiences

        // Act
        val result = logger.saveTrainingBatch()

        // Assert
        assertNull(result)
        verify(exactly = 0) { mockFileSystem.writeString(any(), any()) }
    }

    private fun createTestState(): SmallModifierSelectState {
        return SmallModifierSelectState(
            hpBuckets = doubleArrayOf(1.0, 0.8, 0.6, 0.4, 0.2, 0.0),
            canAffordPotion = 1.0,
            freePotionAvailable = 0.0
        )
    }
}