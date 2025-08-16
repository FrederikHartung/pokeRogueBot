package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonDeserializer
import com.google.gson.JsonSerializer
import com.google.gson.reflect.TypeToken
import com.sfh.pokeRogueBot.file.FileManager
import com.sfh.pokeRogueBot.model.run.RunResult
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
        private val listType = object : TypeToken<MutableList<RunResult>>() {}.type
    }

    fun saveRunResultAfterLostRun(runResult: RunResult) {
        if (shouldSaveRunResultAfterLostRun) {
            val json = fileManager.readJsonFile(pathForRunResults)
            val runResultList: MutableList<RunResult> = mutableListOf()
            if (json != null && json.isNotEmpty()) {
                val existingValues: List<RunResult> = gson.fromJson(json, listType)
                runResultList.addAll(existingValues)
            }

            runResultList.add(runResult)
            fileManager.overwriteJsonFile(pathForRunResults, gson.toJson(runResultList))
            log.debug("Saved runResult after lost-run")
        }
    }
}