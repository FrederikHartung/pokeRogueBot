package com.sfh.pokeRogueBot.file

import org.slf4j.LoggerFactory
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

class FileManagerKt(val fileWrapperFactory: FileWrapperFactory = FileWrapperFactory()) {

    private var fileIndex = 0

    companion object {
        private const val imageIoFileExtension = "png"
        private const val screenshotFileExtension = ".png"
        private val tempDir = Paths.get(".", "data", "temp").toString()
        private val saveDir = Paths.get(".", "data", "save").toString()
        private val log = LoggerFactory.getLogger(FileManagerKt::class.java)
    }

    fun deleteTempData(){
        log.debug("Deleting temp data")
        val folder = fileWrapperFactory.get(tempDir + File.separator)
        val files = folder.listFiles()
        files?.forEach { file ->
            file?.let {
                if(file.isFile()){
                    try{
                        Files.deleteIfExists(file.toPath())
                    } catch (e: Exception){
                        log.error("Could not delete file: {}", file.getName())
                    }
                }
            }
        }
    }
}