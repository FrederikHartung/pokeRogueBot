package com.sfh.pokeRogueBot.model.ui

object PhaseUiTemplates {
    val selectGenderPhaseUi = PhaseUiTemplate(
        15,
        "OptionSelectUiHandler",
        2,
        listOf("Boy", "Girl")
    )
    val titlePhaseUi = PhaseUiTemplate(
        handlerIndex = 1,
        handlerName = "TitleUiHandler",
        configOptionsSize = 4,
        listOf(
            "New Game",
            "Load Game",
            "Run History",
            "Settings",
        )
    )
}