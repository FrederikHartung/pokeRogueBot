package com.sfh.pokeRogueBot.model.rl

import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.util.FileSystemWrapper
import com.sfh.pokeRogueBot.util.RealFileSystemWrapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.nio.file.Path
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Collects and persists training experiences for reinforcement learning.
 *
 * This logger accumulates (state, action, reward, next_state) tuples during
 * gameplay and provides methods to persist them for offline training. The
 * logger is thread-safe and designed to have minimal impact on game performance.
 *
 * Key Features:
 * - Thread-safe experience collection
 * - Automatic batching for efficient I/O
 * - JSON serialization for compatibility with Python ML frameworks
 * - Configurable buffer limits to prevent memory issues
 * - Timestamped files for training session tracking
 *
 * Usage:
 * 1. Log experiences during gameplay with logDecision()
 * 2. Periodically save batches with saveTrainingBatch()
 * 3. Clear buffer when appropriate with clearBuffer()
 */
@Component
class ModifierDecisionLogger(
    private val maxBufferSize: Int = 10000,
    private val outputDirectory: String = "data/training_data",
    private val fileSystem: FileSystemWrapper = RealFileSystemWrapper()
) {
    private val logger = LoggerFactory.getLogger(ModifierDecisionLogger::class.java)
    private val gson = GsonBuilder().setPrettyPrinting().create()
    private val selectModifierExperiences = ConcurrentLinkedQueue<SelectModifierExperience>()

    init {
        // Ensure output directory exists
        val outputPath = fileSystem.toPath(outputDirectory)
        if (!fileSystem.exists(outputPath)) {
            try {
                fileSystem.createDirectories(outputPath)
                logger.info("Created training data directory: $outputDirectory")
            } catch (e: Exception) {
                logger.error("Failed to create training data directory: $outputDirectory", e)
            }
        }
    }

    /**
     * Logs a decision experience for future training.
     *
     * @param state The game state before the action
     * @param action The action that was selected
     * @param reward The reward received for this action
     * @param nextState The resulting state (null if terminal)
     * @param done Whether this is a terminal experience
     */
    fun logDecision(
        state: SmallModifierSelectState,
        action: ModifierAction,
        reward: Double,
        nextState: SmallModifierSelectState? = null,
        done: Boolean = false
    ) {
        val selectModifierExperience = SelectModifierExperience(state, action, reward, nextState, done)
        selectModifierExperiences.offer(selectModifierExperience)

        // Prevent unbounded memory growth
        if (selectModifierExperiences.size > maxBufferSize) {
            logger.warn("Experience buffer exceeded maximum size ($maxBufferSize), removing oldest experiences")
            val removeCount = kotlin.math.max(1, maxBufferSize / 10) // Remove at least 1, up to 10% of buffer
            repeat(removeCount) {
                selectModifierExperiences.poll()
            }
        }

        logger.debug("Logged experience: action=${action}, reward=$reward, done=$done")
    }

    /**
     * Saves current experience buffer to a timestamped JSON file.
     *
     * @param sessionId Optional session identifier for grouping related experiences
     * @return Path to the saved file, or null if save failed
     */
    fun saveTrainingBatch(sessionId: String? = null): Path? {
        val experienceList = getExperienceBuffer()
        if (experienceList.isEmpty()) {
            logger.info("No experiences to save")
            return null
        }

        return try {
            val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
            val sessionPrefix = sessionId?.let { "${it}_" } ?: ""
            val fileName = "${sessionPrefix}experiences_${timestamp}.json"
            val filePath = fileSystem.resolve(outputDirectory, fileName)

            val serializedExperiences = experienceList.map { it.toMap() }
            val jsonData = mapOf(
                "metadata" to mapOf(
                    "timestamp" to timestamp,
                    "sessionId" to sessionId,
                    "experienceCount" to experienceList.size,
                    "stateSize" to 11, // SmallModifierSelectState size
                    "actionCount" to 8 // All ModifierAction enum values: BUY_POTION, TAKE_FREE_POTION, SKIP, TAKE_SACRET_ASH, TAKE_FREE_REVIVE, BUY_REVIVE, TAKE_FREE_MAX_REVIVE, BUY_MAX_REVIVE
                ),
                "experiences" to serializedExperiences
            )

            fileSystem.writeString(filePath, gson.toJson(jsonData))

            logger.info("Saved ${experienceList.size} experiences to $filePath")
            filePath
        } catch (e: Exception) {
            logger.error("Failed to save training batch", e)
            null
        }
    }

    /**
     * Loads experiences from a previously saved JSON file.
     *
     * @param filePath Path to the JSON file containing experiences
     * @return List of loaded experiences, or empty list if loading failed
     */
    fun loadExperiences(filePath: Path): List<SelectModifierExperience> {
        return try {
            if (!fileSystem.exists(filePath)) {
                logger.warn("Experience file does not exist: $filePath")
                return emptyList()
            }

            val jsonText = fileSystem.readString(filePath)
            val jsonData = gson.fromJson(jsonText, Map::class.java) as Map<String, Any>
            val experienceData = jsonData["experiences"] as List<Map<String, Any>>

            val selectModifierExperiences = experienceData.map { SelectModifierExperience.fromMap(it) }
            logger.info("Loaded ${selectModifierExperiences.size} experiences from $filePath")
            selectModifierExperiences
        } catch (e: Exception) {
            logger.error("Failed to load experiences from $filePath", e)
            emptyList()
        }
    }

    /**
     * Returns a snapshot of all currently buffered experiences.
     *
     * @return Immutable list of experiences in the buffer
     */
    fun getExperienceBuffer(): List<SelectModifierExperience> {
        return selectModifierExperiences.toList()
    }

    /**
     * Clears all experiences from the buffer.
     *
     * @return Number of experiences that were cleared
     */
    fun clearBuffer(): Int {
        val clearedCount = selectModifierExperiences.size
        selectModifierExperiences.clear()
        logger.info("Cleared $clearedCount experiences from buffer")
        return clearedCount
    }

    /**
     * Returns current buffer statistics for monitoring.
     *
     * @return Map containing buffer size, memory usage, and other metrics
     */
    fun getBufferStats(): Map<String, Any> {
        val bufferSize = selectModifierExperiences.size
        val avgReward = if (bufferSize > 0) {
            selectModifierExperiences.map { it.reward }.average()
        } else 0.0

        val actionCounts = selectModifierExperiences.groupingBy { it.action }.eachCount()

        return mapOf(
            "bufferSize" to bufferSize,
            "maxBufferSize" to maxBufferSize,
            "bufferUtilization" to (bufferSize.toDouble() / maxBufferSize),
            "averageReward" to avgReward,
            "actionDistribution" to actionCounts,
            "outputDirectory" to outputDirectory
        )
    }

    /**
     * Saves and clears the current buffer in one atomic operation.
     *
     * @param sessionId Optional session identifier
     * @return Path to saved file, or null if save failed
     */
    fun saveAndClearBuffer(sessionId: String? = null): Path? {
        val savedPath = saveTrainingBatch(sessionId)
        if (savedPath != null) {
            clearBuffer()
        }
        return savedPath
    }
}