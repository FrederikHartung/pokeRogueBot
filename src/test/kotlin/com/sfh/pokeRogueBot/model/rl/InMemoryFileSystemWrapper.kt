package com.sfh.pokeRogueBot.model.rl

import java.nio.file.Path
import java.nio.file.Paths

/**
 * In-memory implementation of FileSystemWrapper for testing.
 *
 * This implementation stores all files in memory and doesn't perform any real I/O operations.
 * Perfect for unit tests that need to verify file operations without creating actual files.
 */
class InMemoryFileSystemWrapper : FileSystemWrapper {
    private val files = mutableMapOf<String, String>()
    private val directories = mutableSetOf<String>()

    init {
        // Root directory always exists
        directories.add("")
        directories.add("/")
    }

    override fun exists(path: Path): Boolean {
        val pathStr = path.toString().replace("\\", "/")
        return files.containsKey(pathStr) || directories.contains(pathStr)
    }

    override fun createDirectories(path: Path): Path {
        val pathStr = path.toString().replace("\\", "/")

        // Create all parent directories
        val parts = pathStr.split("/").filter { it.isNotEmpty() }
        var current = ""
        for (part in parts) {
            current = if (current.isEmpty()) part else "$current/$part"
            directories.add(current)
        }

        directories.add(pathStr)
        return path
    }

    override fun writeString(path: Path, content: String): Path {
        val pathStr = path.toString().replace("\\", "/")

        // Ensure parent directory exists
        val parentDir = pathStr.substringBeforeLast("/", "")
        if (parentDir.isNotEmpty()) {
            directories.add(parentDir)
        }

        files[pathStr] = content
        return path
    }

    override fun readString(path: Path): String {
        val pathStr = path.toString().replace("\\", "/")
        return files[pathStr] ?: throw RuntimeException("File not found: $pathStr")
    }

    override fun resolve(base: String, child: String): Path {
        return if (base.isEmpty() || child.startsWith("/")) {
            Paths.get(child)
        } else {
            Paths.get(base, child)
        }
    }

    override fun resolve(base: Path, child: String): Path {
        return base.resolve(child)
    }

    override fun toPath(pathString: String): Path {
        return Paths.get(pathString)
    }

    // Test helper methods
    fun getStoredFiles(): Map<String, String> = files.toMap()

    fun clear() {
        files.clear()
        directories.clear()
        directories.add("")
        directories.add("/")
    }

    fun fileExists(path: String): Boolean = files.containsKey(path.replace("\\", "/"))

    fun getFileContent(path: String): String? = files[path.replace("\\", "/")]
}