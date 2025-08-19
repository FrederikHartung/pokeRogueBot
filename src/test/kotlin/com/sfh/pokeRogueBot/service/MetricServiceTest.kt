package com.sfh.pokeRogueBot.service

import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.poke.PokemonBenchmarkMetric
import com.sfh.pokeRogueBot.model.run.*
import io.mockk.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import java.time.LocalDate

class MetricServiceTest {

    private lateinit var fileManager: FileManager
    private lateinit var metricService: MetricService

    @BeforeEach
    fun setUp() {
        fileManager = mockk()
        metricService = MetricService(fileManager, true)
    }

    @Test
    fun `updateBenchmark should handle empty runResultList`() {
        // Given
        every { fileManager.readJsonFile(any()) } returns null
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val runResultHeader = createRunResultHeader("test-label")
        val emptyRunResultList = mutableListOf<RunResult>()

        // When
        metricService.updateBenchmark(emptyRunResultList, runResultHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(1, savedObjects.size)
        val benchmark = savedObjects["test-label"]
        assertNotNull(benchmark)
        assertEquals(0, benchmark!!.numberOfRuns)
        assertEquals(0, benchmark.minWave)
        assertEquals(0, benchmark.maxWave)
        assertEquals(0, benchmark.avgWave)
        assertEquals(0, benchmark.medianWave)
    }

    @Test
    fun `updateBenchmark should calculate metrics for single run`() {
        // Given
        every { fileManager.readJsonFile(any()) } returns null
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val runResultHeader = createRunResultHeader("test-label")
        val runResult = createRunResult(runResultHeader, 15)
        val runResultList = mutableListOf(runResult)

        // When
        metricService.updateBenchmark(runResultList, runResultHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(1, savedObjects.size)
        val benchmark = savedObjects["test-label"]
        assertNotNull(benchmark)
        assertEquals(1, benchmark!!.numberOfRuns)
        assertEquals(15, benchmark.minWave)
        assertEquals(15, benchmark.maxWave)
        assertEquals(15, benchmark.avgWave)
        assertEquals(15, benchmark.medianWave)
    }

    @Test
    fun `updateBenchmark should calculate metrics for multiple runs with same label`() {
        // Given
        every { fileManager.readJsonFile(any()) } returns null
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val runResultHeader = createRunResultHeader("test-label")
        val runResults = mutableListOf(
            createRunResult(runResultHeader, 10), // min
            createRunResult(runResultHeader, 20),
            createRunResult(runResultHeader, 30), // max
            createRunResult(runResultHeader, 15)  // median calculation: [10,15,20,30] -> (15+20)/2 = 17.5 -> 17
        )

        // When
        metricService.updateBenchmark(runResults, runResultHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(1, savedObjects.size)
        val benchmark = savedObjects["test-label"]
        assertNotNull(benchmark)
        assertEquals(4, benchmark!!.numberOfRuns)
        assertEquals(10, benchmark.minWave)
        assertEquals(30, benchmark.maxWave)
        assertEquals(18, benchmark.avgWave) // (10+20+30+15)/4 = 18.75 -> 18
        assertEquals(17, benchmark.medianWave) // (15+20)/2 = 17.5 -> 17
    }

    @Test
    fun `updateBenchmark should calculate median for odd number of runs`() {
        // Given
        every { fileManager.readJsonFile(any()) } returns null
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val runResultHeader = createRunResultHeader("test-label")
        val runResults = mutableListOf(
            createRunResult(runResultHeader, 10),
            createRunResult(runResultHeader, 20), // median
            createRunResult(runResultHeader, 30)
        )

        // When
        metricService.updateBenchmark(runResults, runResultHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(1, savedObjects.size)
        val benchmark = savedObjects["test-label"]
        assertNotNull(benchmark)
        assertEquals(3, benchmark!!.numberOfRuns)
        assertEquals(20, benchmark.medianWave)
    }

    @Test
    fun `updateBenchmark should filter runs by label`() {
        // Given
        every { fileManager.readJsonFile(any()) } returns null
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val targetHeader = createRunResultHeader("target-label")
        val otherHeader = createRunResultHeader("other-label")

        val runResults = mutableListOf(
            createRunResult(targetHeader, 10),
            createRunResult(otherHeader, 999), // should be ignored
            createRunResult(targetHeader, 20)
        )

        // When
        metricService.updateBenchmark(runResults, targetHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(1, savedObjects.size)
        val benchmark = savedObjects["target-label"]
        assertNotNull(benchmark)
        assertEquals(2, benchmark!!.numberOfRuns)
        assertEquals(10, benchmark.minWave)
        assertEquals(20, benchmark.maxWave)
        // Ensure the ignored run with wave 999 is not included
        assertNotEquals(999, benchmark.minWave)
        assertNotEquals(999, benchmark.maxWave)
    }

    @Test
    fun `updateBenchmark should update existing benchmark data`() {
        // Given
        val existingBenchmarkJson = """{"old-label":{"botName":"OldBot","botVersion":"1.0","runLabel":"old-label","lastUpdate":"2023-01-01","numberOfRuns":5,"minWave":1,"maxWave":10,"avgWave":5,"medianWave":5}}"""
        every { fileManager.readJsonFile(any()) } returns existingBenchmarkJson
        val capturedJson = slot<String>()
        every { fileManager.overwriteJsonFile(any(), capture(capturedJson)) } just Runs

        val runResultHeader = createRunResultHeader("new-label")
        val runResult = createRunResult(runResultHeader, 25)
        val runResultList = mutableListOf(runResult)

        // When
        metricService.updateBenchmark(runResultList, runResultHeader)

        // Then
        val savedJson = capturedJson.captured
        val savedObjects: Map<String, RunBenchmark> = MetricService.gson.fromJson(savedJson, MetricService.mapTypeBenchmark)
        assertEquals(2, savedObjects.size)
        val newData = savedObjects.get("new-label")
        assertNotNull(newData)
        assertEquals(25, newData!!.maxWave)
    }

    private fun createRunResultHeader(runLabel: String): RunResultHeader {
        return RunResultHeader(
            botName = "TestBot",
            botVersion = "1.0.0",
            date = LocalDate.now(),
            runLabel = runLabel,
            runLabelIndex = 10
        )
    }

    private fun createRunResult(header: RunResultHeader, waveIndex: Int): RunResult {
        val body = RunResultBody(
            money = 1000,
            team = listOf(),
            waveIndex = waveIndex
        )
        return RunResult(
            runResultType = RunResultType.LOST,
            runResultHeader = header,
            runResultBody = body
        )
    }
}