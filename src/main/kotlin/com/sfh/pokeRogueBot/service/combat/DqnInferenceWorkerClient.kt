package com.sfh.pokeRogueBot.service.combat

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@Component
class DqnInferenceWorkerClient(
    @param:Value("\${bot.dqn.python-command:python3}") private val pythonCommand: String,
    @param:Value("\${bot.dqn.infer-script:scripts/02-training/inference/dqn_policy_infer_worker.py}") private val inferScriptPath: String,
    @param:Value("\${bot.dqn.combat-checkpoint:data/rl/models/dqn-combat-wave-library-random-valid-action-6800-stable.pt}") private val checkpointPath: String,
    @param:Value("\${bot.dqn.device:cpu}") private val device: String,
    @param:Value("\${bot.dqn.worker-timeout-ms:5000}") private val workerTimeoutMs: Long,
) : DisposableBean {

    companion object {
        private val log = LoggerFactory.getLogger(DqnInferenceWorkerClient::class.java)
    }

    private val objectMapper = ObjectMapper()
    private val readerExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "dqn-infer-worker-reader").apply { isDaemon = true }
    }

    @Volatile
    private var process: Process? = null

    @Volatile
    private var writer: BufferedWriter? = null

    @Volatile
    private var reader: BufferedReader? = null

    /** Feature-Version des geladenen Checkpoints (6 = combat-v3, 7 = combat-v4); null bis zur ersten Abfrage. */
    @Volatile
    private var featureSchemaVersion: Int? = null

    @Synchronized
    fun inferAction(state: Map<String, Any>, actionMask: List<Int>): Int? {
        val payload = request(mapOf("state" to state, "action_mask" to actionMask), "inference") ?: return null
        return payload.get("action")?.takeIf(JsonNode::isInt)?.asInt()
    }

    /**
     * Feature-Version des Checkpoints, einmal pro Worker-Start per `describe` erfragt. Davon haengt ab, ob Zwangswechsel und
     * Wechselangebot mit eigener Entscheidungsart (combat-v4) oder wie bisher als Command-State mit Wechsel-Maske laufen.
     */
    @Synchronized
    fun featureSchemaVersion(): Int? {
        featureSchemaVersion?.let { return it }
        val payload = request(mapOf("describe" to true), "describe") ?: return null
        return payload.get("feature_schema_version")?.takeIf(JsonNode::isInt)?.asInt()?.also { featureSchemaVersion = it }
    }

    private fun request(body: Map<String, Any>, label: String): JsonNode? {
        val checkpointFile = File(checkpointPath)
        if (!checkpointFile.exists()) {
            log.warn("DQN checkpoint not found at {}, skipping model {}", checkpointFile.absolutePath, label)
            return null
        }

        return try {
            ensureWorkerStarted(checkpointFile)

            val currentWriter = writer ?: return null
            val currentReader = reader ?: return null
            currentWriter.write(objectMapper.writeValueAsString(body))
            currentWriter.newLine()
            currentWriter.flush()

            val future = readerExecutor.submit<String?> {
                currentReader.readLine()
            }
            val rawResponse = future.get(workerTimeoutMs, TimeUnit.MILLISECONDS)
                ?: throw IllegalStateException("DQN worker closed stdout unexpectedly")

            val payload = objectMapper.readTree(rawResponse)
            if (payload.hasNonNull("error")) {
                log.warn("DQN worker returned {} error: {}", label, payload.get("error").asText())
                restartWorker("worker returned $label error")
                null
            } else {
                payload
            }
        } catch (ex: Exception) {
            log.warn("Persistent DQN {} failed, restarting worker", label, ex)
            restartWorker("request failure")
            null
        }
    }

    @Synchronized
    private fun ensureWorkerStarted(checkpointFile: File) {
        val currentProcess = process
        if (currentProcess != null && currentProcess.isAlive) {
            return
        }

        closeWorker()
        val startedProcess = ProcessBuilder(
            pythonCommand,
            inferScriptPath,
            "--checkpoint",
            checkpointFile.path,
            "--device",
            device,
        )
            .redirectErrorStream(true)
            .start()

        process = startedProcess
        writer = startedProcess.outputStream.bufferedWriter(StandardCharsets.UTF_8)
        reader = startedProcess.inputStream.bufferedReader(StandardCharsets.UTF_8)
        log.info(
            "Started persistent DQN inference worker with checkpoint={} script={}",
            checkpointFile.path,
            inferScriptPath,
        )
    }

    @Synchronized
    private fun restartWorker(reason: String) {
        log.info("Restarting DQN inference worker: {}", reason)
        closeWorker()
    }

    @Synchronized
    private fun closeWorker() {
        try {
            writer?.let { currentWriter ->
                currentWriter.write("{\"shutdown\":true}")
                currentWriter.newLine()
                currentWriter.flush()
            }
        } catch (_: Exception) {
        }

        try {
            writer?.close()
        } catch (_: Exception) {
        }

        try {
            reader?.close()
        } catch (_: Exception) {
        }

        process?.let { currentProcess ->
            if (currentProcess.isAlive) {
                currentProcess.destroy()
                if (!currentProcess.waitFor(250, TimeUnit.MILLISECONDS)) {
                    currentProcess.destroyForcibly()
                }
            }
        }

        writer = null
        reader = null
        process = null
        featureSchemaVersion = null
    }

    override fun destroy() {
        closeWorker()
        readerExecutor.shutdownNow()
    }
}
