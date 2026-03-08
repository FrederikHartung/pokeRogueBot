package com.sfh.pokeRogueBot.file

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.awt.image.BufferedImage
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.imageio.ImageIO

@Component
class FileManager {

    companion object {
        const val IMAGE_IO_FILE_EXTENSION = "png"
        const val SCREENSHOT_FILE_EXTENSION = ".png"
        val DIR_TEMP: String = Paths.get(".", "data", "temp").toString()
        val DIR_SAVE: String = Paths.get(".", "data", "save").toString()

        private val log = LoggerFactory.getLogger(FileManager::class.java)
    }

    private var fileIndex = 0

    fun deleteTempData() {
        log.debug("Deleting temp data")
        val folder = File(DIR_TEMP + File.separator)
        val files = folder.listFiles() ?: return

        files.forEach { file ->
            if (file != null && file.isFile) {
                try {
                    Files.deleteIfExists(file.toPath())
                } catch (e: Exception) {
                    log.error("Could not delete file: {}", file.name)
                }
            }
        }
    }

    fun saveTempImage(bufferedImage: BufferedImage, fileNamePrefix: String) {
        val filePath = getTempFilePath(fileNamePrefix)

        try {
            if (Files.notExists(getTempDir())) {
                Files.createDirectories(getTempDir())
            }
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, File(filePath))
            fileIndex++
            log.info("Temp Screenshot persisted: {}", filePath)
        } catch (e: Exception) {
            log.error("Error while saving temp screenshot to: {}, error: {}", filePath, e.message)
        }
    }

    fun persistImage(bufferedImage: BufferedImage, prefix: String) {
        val filePath = getSaveFilePath(prefix)

        try {
            if (Files.notExists(getSaveDir())) {
                Files.createDirectories(getSaveDir())
            }
            ImageIO.write(bufferedImage, IMAGE_IO_FILE_EXTENSION, File(filePath))
            fileIndex++
            log.info("Screenshot persisted: {}", filePath)
        } catch (e: Exception) {
            log.error("Error while saving screenshot to: {}, error: {}", filePath, e.message)
        }
    }

    fun getTempFilePath(fileNamePrefix: String): String {
        return DIR_TEMP + File.separator + fileIndex + "_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION
    }

    fun getSaveFilePath(fileNamePrefix: String): String {
        val dateTimeAsString = getDateTimestamp()
        return DIR_SAVE + File.separator + dateTimeAsString + "_" + fileNamePrefix + SCREENSHOT_FILE_EXTENSION
    }

    fun getTempDir(): Path = Paths.get(DIR_TEMP + File.separator)

    fun getSaveDir(): Path = Paths.get(DIR_SAVE + File.separator)

    private fun getDateTimestamp(): String {
        val datetimeFormat = "yyyy-MM-dd_HH-mm-ss"
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern(datetimeFormat))
    }

    fun readJsonFile(itemsPath: Path): String? {
        val parent = itemsPath.parent
        if (Files.notExists(parent)) {
            try {
                Files.createDirectories(parent)
            } catch (e: Exception) {
                log.error("Could not create directory: {}", parent)
                return null
            }
        }

        if (Files.notExists(itemsPath)) {
            try {
                Files.createFile(itemsPath)
            } catch (e: Exception) {
                log.error("Could not create file: {}", itemsPath)
                return null
            }
        }

        return try {
            Files.readString(itemsPath)
        } catch (e: Exception) {
            log.error("Could not read file: {}", itemsPath)
            null
        }
    }

    fun overwriteJsonFile(itemsPath: Path, json: String) {
        val parent = itemsPath.parent
        if (Files.notExists(parent)) {
            try {
                Files.createDirectories(parent)
            } catch (e: Exception) {
                log.error("Could not create directory: {}", parent)
                return
            }
        }

        if (Files.notExists(itemsPath)) {
            try {
                Files.createFile(itemsPath)
            } catch (e: Exception) {
                log.error("Could not create file: {}", itemsPath)
                return
            }
        }

        try {
            Files.writeString(itemsPath, json)
        } catch (e: Exception) {
            log.error("Could not write file: {}", itemsPath)
        }
    }
}
