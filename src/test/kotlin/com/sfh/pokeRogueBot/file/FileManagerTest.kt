package com.sfh.pokeRogueBot.file

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.fail

class FileManagerTest {

    private fun isWindows(): Boolean {
        return System.getProperty("os.name").lowercase().contains("win")
    }

    private fun isMacOrLinux(): Boolean {
        val osName = System.getProperty("os.name").lowercase()
        return osName.contains("mac") || osName.contains("linux") || osName.contains("nix")
    }

    private val fileManager = FileManager()

    @Test
    fun `a filepath is returned`() {
        val fileNamePrefix = "test"
        val filePath = fileManager.getTempFilePath(fileNamePrefix)

        when {
            isWindows() -> {
                assertEquals(".\\data\\temp\\0_test.png", filePath)
            }

            isMacOrLinux() -> {
                assertEquals("./data/temp/0_test.png", filePath)
            }

            else -> {
                fail("Unknown OS: ${System.getProperty("os.name")}, please add the OS to the test")
            }
        }
    }

    @Test
    fun `a directory path is returned`() {
        val screenshotTempDirPath = fileManager.screenshotTempDirPath

        when {
            isWindows() -> {
                assertEquals(".\\data\\temp\\", screenshotTempDirPath)
            }

            isMacOrLinux() -> {
                assertEquals("./data/temp/", screenshotTempDirPath)
            }

            else -> {
                fail("Unknown OS: ${System.getProperty("os.name")}, please add the OS to the test")
            }
        }
    }
}