package com.sfh.pokeRogueBot.service.combat

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

class DqnInferenceWorkerClientTest {

    @TempDir
    lateinit var tempDir: File

    private var client: DqnInferenceWorkerClient? = null

    @AfterEach
    fun tearDown() {
        client?.destroy()
    }

    @Test
    fun `stderr output of the worker does not break the json response`() {
        // Fake worker: warns on stderr (like a torch/numpy import warning), then answers each request on stdout.
        val script = File(tempDir, "fake_worker.sh").apply {
            writeText(
                """
                echo "UserWarning: Failed to initialize NumPy" >&2
                while IFS= read -r line; do
                  case "${'$'}line" in
                    *shutdown*) exit 0 ;;
                    *describe*) echo '{"feature_schema_version":7}' ;;
                    *) echo "warning per request" >&2; echo '{"action":3}' ;;
                  esac
                done
                """.trimIndent()
            )
        }
        val checkpoint = File(tempDir, "model.pt").apply { writeText("") }

        val workerClient = DqnInferenceWorkerClient(
            pythonCommand = "sh",
            inferScriptPath = script.path,
            checkpointPath = checkpoint.path,
            device = "cpu",
            workerTimeoutMs = 5000,
        ).also { client = it }

        assertEquals(7, workerClient.featureSchemaVersion())
        assertEquals(3, workerClient.inferAction(mapOf("x" to 1), listOf(1, 1)))
        assertEquals(3, workerClient.inferAction(mapOf("x" to 2), listOf(1, 1)))
    }
}
