package com.sfh.pokeRogueBot.util

import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths

object FileUtils {
    @Throws(IOException::class)
    fun readJsonFile(filePath: String): String {
        return String(Files.readAllBytes(Paths.get(filePath)))
    }
}
