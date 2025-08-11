package com.sfh.pokeRogueBot.model.exception

class UnsupportedUiModeException : RuntimeException {

    constructor(uiMode: String) : super("uiMode " + uiMode + " is not supported yet")
}