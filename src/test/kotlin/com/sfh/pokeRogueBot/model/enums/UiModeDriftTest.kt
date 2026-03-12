package com.sfh.pokeRogueBot.model.enums

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.exists

class UiModeDriftTest {

    @Test
    fun `local ui mode enum matches pokerogue submodule`() {
        val upstreamFile = Path.of("pokerogue", "src", "enums", "ui-mode.ts")
        check(upstreamFile.exists()) { "Missing pokerogue UiMode source at $upstreamFile" }

        val upstreamModes = Files.readAllLines(upstreamFile)
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("export enum") && it != "}" }
            .mapIndexed { index, line ->
                line.removeSuffix(",") to index
            }

        val localModes = UiMode.entries.map { it.name to it.value }

        assertEquals(
            upstreamModes,
            localModes,
            "UiMode drift detected between local enum and pokerogue submodule. Update src/main/kotlin/.../UiMode.kt to match pokerogue/src/enums/ui-mode.ts",
        )
    }
}
