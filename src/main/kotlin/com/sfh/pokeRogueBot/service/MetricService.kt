package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonDeserializer
import com.google.gson.JsonSerializer
import com.google.gson.reflect.TypeToken
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.run.RunBenchmark
import com.sfh.pokeRogueBot.model.run.RunResult
import com.sfh.pokeRogueBot.model.run.RunResultHeader
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.nio.file.Path
import java.nio.file.Paths
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Service
class MetricService(
    val fileManager: FileManager,
    @param:Value("\${app.metric.save-run-result-after-lost-run}") val shouldSaveRunResultAfterLostRun: Boolean
) {

    companion object {
        private val log = LoggerFactory.getLogger(MetricService::class.java)
        val gson: Gson = GsonBuilder()
            .registerTypeAdapter(LocalDate::class.java, JsonSerializer<LocalDate> { src, _, _ ->
                com.google.gson.JsonPrimitive(src.format(DateTimeFormatter.ISO_LOCAL_DATE))
            })
            .registerTypeAdapter(LocalDate::class.java, JsonDeserializer<LocalDate> { json, _, _ ->
                LocalDate.parse(json.asString, DateTimeFormatter.ISO_LOCAL_DATE)
            })
            .setPrettyPrinting()
            .create()
        private val pathForRunResults: Path = Paths.get(".", "data", "runMetrics.json")
        private val pathForBenchmarkResults: Path = Paths.get(".", "data", "runBenchmarks.json")
        private val listTypeRunResult = object : TypeToken<MutableList<RunResult>>() {}.type
        val mapTypeBenchmark = object : TypeToken<MutableMap<String, RunBenchmark>>() {}.type
    }

    fun saveRunResultAfterLostRun(runResult: RunResult) {
        if (shouldSaveRunResultAfterLostRun) {
            val json = fileManager.readJsonFile(pathForRunResults)
            val runResultList: MutableList<RunResult> = mutableListOf()
            if (json != null && json.isNotEmpty()) {
                val existingValues: List<RunResult> = gson.fromJson(json, listTypeRunResult)
                runResultList.addAll(existingValues)
            }

            runResultList.add(runResult)
            fileManager.overwriteJsonFile(pathForRunResults, gson.toJson(runResultList))
            log.debug("Saved runResult after lost-run")
            updateBenchmark(runResultList, runResult.runResultHeader)
        }
    }

    internal fun updateBenchmark(runResultList: MutableList<RunResult>, runResultHeader: RunResultHeader) {
        val json = fileManager.readJsonFile(pathForBenchmarkResults)
        val benchmarkMap: MutableMap<String, RunBenchmark> = mutableMapOf()
        if (json != null && json.isNotEmpty()) {
            val existingValues: Map<String, RunBenchmark> = gson.fromJson(json, mapTypeBenchmark)
            benchmarkMap.putAll(existingValues)
        }

        //find all RunResult, where the runLabel is runResultHeader.runLabel, than fill this variabels:
        val matchingRuns = runResultList.filter { it.runResultHeader.runLabel == runResultHeader.runLabel }
        val waveIndices = matchingRuns.map { it.runResultBody.waveIndex }

        val numberOfRuns = matchingRuns.size
        val minWave = waveIndices.minOrNull() ?: 0
        val maxWave = waveIndices.maxOrNull() ?: 0
        val avgWave = if (waveIndices.isNotEmpty()) waveIndices.average().toInt() else 0
        val medianWave = if (waveIndices.isNotEmpty()) {
            val sortedWaves = waveIndices.sorted()
            val middle = sortedWaves.size / 2
            if (sortedWaves.size % 2 == 0) {
                ((sortedWaves[middle - 1] + sortedWaves[middle]) / 2.0).toInt()
            } else {
                sortedWaves[middle]
            }
        } else 0

        val newBenchmark = RunBenchmark(
            botName = runResultHeader.botName,
            botVersion = runResultHeader.botVersion,
            runLabel = runResultHeader.runLabel,
            lastUpdate = LocalDate.now(),
            numberOfRuns = numberOfRuns,
            minWave = minWave,
            maxWave = maxWave,
            avgWave = avgWave,
            medianWave = medianWave
        )

        benchmarkMap[runResultHeader.runLabel] = newBenchmark
        fileManager.overwriteJsonFile(pathForBenchmarkResults, gson.toJson(benchmarkMap))
    }
}