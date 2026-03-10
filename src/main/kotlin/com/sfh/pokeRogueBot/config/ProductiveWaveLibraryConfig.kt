package com.sfh.pokeRogueBot.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "bot.productive-wave-library")
data class ProductiveWaveLibraryConfig(
    val enabled: Boolean = false,
    val outputDir: String = "data/offline-wave-library",
    val snapshotFileName: String = "productive-wave-snapshots-v1.jsonl",
    val fingerprintFileName: String = "productive-wave-fingerprints-v1.txt",
)
