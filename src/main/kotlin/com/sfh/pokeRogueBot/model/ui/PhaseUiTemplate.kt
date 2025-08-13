package com.sfh.pokeRogueBot.model.ui

data class PhaseUiTemplate(
    val handlerIndex: Int,
    val handlerName: String,
    val validateConfigOption: Boolean,
    val configOptionsSize: Int,
    val configOptionsLabel: List<String>
)
