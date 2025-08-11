package com.sfh.pokeRogueBot.model.browser.gamejson

data class UiHandler(
    val active: Boolean,
    val awaitingActionInput: Boolean, //TODO: maybe this variable is not present on all ui handlers and should be removed
    val index: Int,
    val name: String,
    val configOptionsSize: Int,
    val configOptionsLabel: List<String>
)
