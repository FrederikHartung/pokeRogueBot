package com.sfh.pokeRogueBot.model.run

import java.time.LocalDate

data class RunBenchmark(
    val botName: String,
    val botVersion: String,
    val runLabel: String,
    val lastUpdate: LocalDate,
    val numberOfRuns: Int,
    val minWave: Int,
    val maxWave: Int,
    val avgWave: Int,
    val medianWave: Int,
)
