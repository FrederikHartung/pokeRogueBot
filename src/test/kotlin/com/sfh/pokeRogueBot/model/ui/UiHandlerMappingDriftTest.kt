package com.sfh.pokeRogueBot.model.ui

import com.sfh.pokeRogueBot.model.enums.UiMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.nio.file.Files
import java.nio.file.Path

class UiHandlerMappingDriftTest {

    @Test
    fun `local ui handler mappings match pokerogue ui handler registrations`() {
        val uiHandlerService = UiHandlerService()
        val upstreamHandlers = parseUpstreamHandlers(Path.of("pokerogue", "src", "ui", "ui.ts"))

        val mismatches = uiHandlerService.getHandlerMappings().mapNotNull { (uiMode, template) ->
            val upstreamHandlerName = upstreamHandlers[uiMode.value]
            when {
                template.handlerIndex != uiMode.value ->
                    "$uiMode -> local handlerIndex=${template.handlerIndex}, expected enum value ${uiMode.value}"

                upstreamHandlerName == null ->
                    "$uiMode -> no upstream handler registered at index ${uiMode.value}"

                template.handlerName != upstreamHandlerName ->
                    "$uiMode -> local handlerName=${template.handlerName}, upstream handlerName=$upstreamHandlerName"

                else -> null
            }
        }

        assertEquals(
            emptyList<String>(),
            mismatches,
            "UiHandlerService drift detected against pokerogue/src/ui/ui.ts",
        )
    }

    private fun parseUpstreamHandlers(path: Path): Map<Int, String> {
        check(Files.exists(path)) { "Missing upstream UI definition at $path" }
        val lines = Files.readAllLines(path)
        val startIndex = lines.indexOfFirst { it.contains("this.handlers = [") }
        check(startIndex >= 0) { "Could not find this.handlers registration block in $path" }
        val endIndex = lines.subList(startIndex, lines.size).indexOfFirst { it.contains("];") }
        check(endIndex >= 0) { "Could not find end of this.handlers registration block in $path" }

        val handlerRegex = Regex("""new\s+([A-Za-z0-9_]+)\s*\(""")
        return lines.subList(startIndex + 1, startIndex + endIndex)
            .mapNotNull { line ->
                val match = handlerRegex.find(line.trim()) ?: return@mapNotNull null
                match.groupValues[1]
            }
            .mapIndexed { index, handlerName -> index to handlerName }
            .toMap()
    }
}
