package com.sfh.pokeRogueBot.model.exception

import com.sfh.pokeRogueBot.model.enums.UiMode

class UnsupportedPhaseException : RuntimeException {
    constructor(
        phase: String,
        gameMode: UiMode
    ) : super("Phase " + phase + " with GameMode " + gameMode + " is not supported yet")

    constructor(phase: String) : super("Phase " + phase + " is not supported yet")
}