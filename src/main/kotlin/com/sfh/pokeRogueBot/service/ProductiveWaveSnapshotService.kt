package com.sfh.pokeRogueBot.service

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sfh.pokeRogueBot.config.ProductiveWaveLibraryConfig
import com.sfh.pokeRogueBot.model.dto.WaveDto
import com.sfh.pokeRogueBot.model.run.ProductiveWaveSnapshotRecord
import com.sfh.pokeRogueBot.model.run.toProductiveWaveSnapshot
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

@Service
class ProductiveWaveSnapshotService(
    private val config: ProductiveWaveLibraryConfig,
) {

    companion object {
        private val log = LoggerFactory.getLogger(ProductiveWaveSnapshotService::class.java)
    }

    private val gson: Gson = GsonBuilder().disableHtmlEscaping().create()
    private val seenFingerprints: MutableSet<String> = linkedSetOf()
    private var initialized = false

    @Synchronized
    fun persistSnapshotIfNew(waveDto: WaveDto): Boolean {
        if (!config.enabled) {
            log.debug("Productive wave library disabled, skipping snapshot for wave {}", waveDto.waveIndex)
            return false
        }

        initializeSeenFingerprintsIfNeeded()

        val snapshot = waveDto.toProductiveWaveSnapshot()
        val fingerprint = calculateFingerprint(snapshot)
        if (!seenFingerprints.add(fingerprint)) {
            log.debug("Skipping duplicate productive wave snapshot for wave {}", snapshot.waveIndex)
            return false
        }

        val record = ProductiveWaveSnapshotRecord(
            fingerprint = fingerprint,
            snapshot = snapshot,
        )
        val outputDir = getOutputDir()
        Files.createDirectories(outputDir)
        Files.writeString(
            getSnapshotFile(outputDir),
            gson.toJson(record) + System.lineSeparator(),
            StandardCharsets.UTF_8,
            java.nio.file.StandardOpenOption.CREATE,
            java.nio.file.StandardOpenOption.APPEND,
        )
        Files.writeString(
            getFingerprintFile(outputDir),
            fingerprint + System.lineSeparator(),
            StandardCharsets.UTF_8,
            java.nio.file.StandardOpenOption.CREATE,
            java.nio.file.StandardOpenOption.APPEND,
        )
        log.info("Persisted productive wave snapshot V1 for wave {} with fingerprint {}", snapshot.waveIndex, fingerprint)
        return true
    }

    fun calculateFingerprint(waveDto: WaveDto): String {
        return calculateFingerprint(waveDto.toProductiveWaveSnapshot())
    }

    fun calculateFingerprint(snapshot: Any): String {
        val canonicalJson = gson.toJson(snapshot)
        return MessageDigest.getInstance("SHA-256")
            .digest(canonicalJson.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    @Synchronized
    fun resetInMemoryStateForTests() {
        seenFingerprints.clear()
        initialized = false
    }

    private fun initializeSeenFingerprintsIfNeeded() {
        if (initialized) {
            return
        }

        val fingerprintFile = getFingerprintFile(getOutputDir())
        if (Files.exists(fingerprintFile)) {
            Files.readAllLines(fingerprintFile, StandardCharsets.UTF_8)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .forEach(seenFingerprints::add)
        }
        initialized = true
    }

    private fun getOutputDir(): Path = Path.of(config.outputDir)

    private fun getSnapshotFile(outputDir: Path): Path = outputDir.resolve(config.snapshotFileName)

    private fun getFingerprintFile(outputDir: Path): Path = outputDir.resolve(config.fingerprintFileName)
}
