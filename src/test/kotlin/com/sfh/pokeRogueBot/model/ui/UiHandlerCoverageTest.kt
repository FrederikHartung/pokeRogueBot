package com.sfh.pokeRogueBot.model.ui

import com.sfh.pokeRogueBot.model.enums.UiMode
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.extension
import kotlin.io.path.name
import kotlin.io.path.readText
import kotlin.streams.asSequence

class UiHandlerCoverageTest {

    private val phaseDirectory = Path.of("src", "main", "kotlin", "com", "sfh", "pokeRogueBot", "phase", "impl")
    private val handledUiModeRegex = Regex("""UiMode\.([A-Z_]+)\s*(->|\))""")
    private val handlerlessAllowedModes = setOf(
        UiMode.EVOLUTION_SCENE,
        UiMode.LOADING,
        UiMode.LOGIN_FORM,
    )

    @Test
    fun `phase ui modes are either mapped to a handler or explicitly allowed to be handlerless`() {
        val uiHandlerService = UiHandlerService()

        val phaseUiModeUsages = Files.walk(phaseDirectory).use { paths ->
            paths.asSequence()
                .filter { Files.isRegularFile(it) && it.extension == "kt" }
                .map { file ->
                    val matches = handledUiModeRegex.findAll(file.readText())
                        .map { match -> UiMode.valueOf(match.groupValues[1]) }
                        .toSet()
                    file.name to matches
                }
                .filter { (_, modes) -> modes.isNotEmpty() }
                .toList()
        }

        val missingMappings = phaseUiModeUsages.flatMap { (fileName, modes) ->
            modes
                .filterNot { uiHandlerService.hasHandlerForUiMode(it) || it in handlerlessAllowedModes }
                .map { "$fileName -> $it" }
        }

        assertTrue(
            missingMappings.isEmpty(),
            "Phase UiMode coverage drift detected. Add missing UiHandlerService mappings or explicitly allow handlerless modes: $missingMappings",
        )
    }
}
