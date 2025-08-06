package com.sfh.pokeRogueBot.util

import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths

class FileUtilsTest {

    @Test
    fun `readJsonFile should return file content when file exists`() {
        val filePath = "test.json"
        val expectedContent = "{\"key\":\"value\"}"
        mockkStatic(Paths::class, Files::class)
        every { Paths.get(filePath) } returns mockk()
        every { Files.readAllBytes(any()) } returns expectedContent.toByteArray()

        val result = FileUtils.readJsonFile(filePath)

        assertEquals(expectedContent, result)
    }

    @Test
    fun `readJsonFile should throw IOException when file reading fails`() {
        val filePath = "invalid.json"
        mockkStatic(Paths::class, Files::class)
        every { Paths.get(filePath) } returns mockk()
        every { Files.readAllBytes(any()) } throws IOException("File not found")

        assertThrows<IOException> {
            FileUtils.readJsonFile(filePath)
        }
    }
}