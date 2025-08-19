package com.sfh.pokeRogueBot.model.run

import java.time.LocalDate

data class RunResultHeader(
    val botName: String,
    val botVersion: String,
    val date: LocalDate = LocalDate.now(),
    val runLabel: String,
    var runLabelIndex: Int = 0,
)
