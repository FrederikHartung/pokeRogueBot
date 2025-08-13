package com.sfh.pokeRogueBot.model.ui

object PhaseUiTemplates {
    val selectGenderPhaseWithOptionSelect = PhaseUiTemplate(
        15,
        "OptionSelectUiHandler",
        2,
        listOf("Boy", "Girl")
    )
    val titlePhaseWithTitle = PhaseUiTemplate(
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
    val titlePhaseWithOptionSelect = PhaseUiTemplate(
        handlerIndex = 15,
        handlerName = "OptionSelectUiHandler",
        configOptionsSize = 3,
        listOf(
            "Classic",
            "Daily Run",
            "Cancel",
        )
    )
    val titlePhaseWithSaveSlot = PhaseUiTemplate(
        handlerIndex = 7,
        handlerName = "SaveSlotSelectUiHandler",
        configOptionsSize = 0,
        listOf(
        )
    )
}