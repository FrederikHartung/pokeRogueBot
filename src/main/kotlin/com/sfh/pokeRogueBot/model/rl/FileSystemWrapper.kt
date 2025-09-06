package com.sfh.pokeRogueBot.model.rl

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Abstraction layer for file system operations to enable testing without real I/O.
 *
 * This wrapper allows us to mock file operations in unit tests while maintaining
 * the same interface for production code.
 */
interface FileSystemWrapper {
    fun exists(path: Path): Boolean
    fun createDirectories(path: Path): Path
    fun writeString(path: Path, content: String): Path
    fun readString(path: Path): String
    fun resolve(base: String, child: String): Path
    fun resolve(base: Path, child: String): Path
    fun toPath(pathString: String): Path
}

/**
 * Production implementation that delegates to java.nio.file operations.
 */
class RealFileSystemWrapper : FileSystemWrapper {
    override fun exists(path: Path): Boolean = Files.exists(path)

    override fun createDirectories(path: Path): Path = Files.createDirectories(path)

    override fun writeString(path: Path, content: String): Path {
        Files.write(path, content.toByteArray())
        return path
    }

    override fun readString(path: Path): String = Files.readString(path)

    override fun resolve(base: String, child: String): Path = Paths.get(base, child)

    override fun resolve(base: Path, child: String): Path = base.resolve(child)

    override fun toPath(pathString: String): Path = Paths.get(pathString)
}