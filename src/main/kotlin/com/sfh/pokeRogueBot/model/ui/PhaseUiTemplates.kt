package com.sfh.pokeRogueBot.model.ui

object PhaseUiTemplates {
    val selectGenderPhaseWithOptionSelect = PhaseUiTemplate(
        15,
        "OptionSelectUiHandler",
        true,
        2,
        listOf("Boy", "Girl")
    )
    val titlePhaseWithTitle = PhaseUiTemplate(
        handlerIndex = 1,
        handlerName = "TitleUiHandler",
        true,
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
        true,
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
        false,
        configOptionsSize = -1,
        listOf()
    )
    val starterSelectWithStarterSelect = PhaseUiTemplate(
        10,
        "StarterSelectUiHandler",
        false,
        -1,
        listOf()
    )
    val starterSelectWithOptionSelect = PhaseUiTemplate(
        15,
        "OptionSelectUiHandler",
        false,
        -1,
        listOf()
    )
    val starterSelectWithConfirm = PhaseUiTemplate(
        15,
        "OptionSelectUiHandler",
        false,
        -1,
        listOf()
    )
    val starterSelectWithSaveSlot = PhaseUiTemplate(
        7,
        "SaveSlotSelectUiHandler",
        false,
        -1,
        listOf()
    )
    val commandWithCommand = PhaseUiTemplate(
        2,
        "CommandUiHandler",
        false,
        -1,
        listOf()
    )
    val selectModifierWithSelectModifier = PhaseUiTemplate(
        6,
        "ModifierSelectUiHandler",
        false,
        -1,
        listOf()
    )
    val attemptCaptureWithConfirm = PhaseUiTemplate(
        14,
        "ConfirmUiHandler",
        true,
        4,
        listOf(
            "Summary",
            "Pokédex",
            "Yes",
            "No"
        )
    )
    val switchPhaseWithParty = PhaseUiTemplate(
        8,
        "PartyUiHandler",
        false,
        -1,
        listOf()
    )
}